const mongodb = require("mongodb");
let mongo_client = null;

// database
const connection_mongoDB = process.env["connection_mongoDB"];
const MONGO_DB_NAME = process.env["MONGO_DB_NAME"];

// middlewares
const bcrypt = require("bcryptjs");
const validator = require("validator");

// constants environment
const AZURE_STORAGE_CONNECTION_STRING =
  process.env["AUTH_AZURE_STORAGE_CONNECTION_STRING"];
const STORAGE_ACCOUNT_NAME = process.env["AZURE_STORAGE_ACCOUNT_NAME"];

module.exports = function (context, req) {
  switch (req.method) {
    case "GET":
      GET_user();
      break;
    case "POST":
      POST_user();
      break;
    case "PUT":
      PUT_user();
      break;
    default:
      notAllowed();
      break;
  }

  async function GET_user() {
    let requestedID;
    if (req.query) requestedID = req.query["id"];
    try {
      // search user by Id
      if (requestedID) {
        let person = await getUsers(requestedID);
        context.res = {
          body: person,
          headers: { "Content-Type": "application/json" },
        };
        context.done();
        // search all users
      } else {
        let people = await getUser();
        context.res = {
          body: people,
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
    } catch (error) {
      if (error.body) {
        context.res = error;
        context.done();
      }
      context.res = {
        status: 500,
        body: error.toString(),
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    }

    // Internal functions

    async function getUsers(id) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .aggregate([
              { $match: { _id: mongodb.ObjectID(id) } },
              { $project: { password: 0 } },
            ])
            .toArray(function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error,
                  headers: { "Content-Type": "application/json" },
                });
              }
              if (docs.length === 0) {
                reject({
                  status: 404,
                  body: "AU-001",
                  headers: { "Content-Type": "application/json" },
                });
              }
              resolve(docs);
            });
        } catch (error) {
          context.log(error);
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function getUser() {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .aggregate([
              {
                $project: { password: 0 },
              },
            ])
            .toArray(function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
              }
              if (docs.length === 0) {
                reject({
                  status: 404,
                  body: "AU-002",
                  headers: { "Content-Type": "application/json" },
                });
              }
              resolve(docs);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }
  }

  async function POST_user() {
    let person;
    // get variables from body
    let personSubsidiaries = req.body["sucursal"];
    let personName = req.body["nombre"];
    let personMiddleName = req.body["apellido_paterno"];
    let personLastName = req.body["apellido_materno"];
    let personAvatar = req.body["foto"];
    let userData = req.body["user"];
    let userPermissions = req.body["permissions"];

    validate();

    try {
      let subsidiaries = [];
      let personAvatarUrl;

      // get subsidiaries if user has
      if (personSubsidiaries) {
        for (let id of personSubsidiaries) {
          if (id.length === 24) {
            const subs = await searchSubsidiary(id);
            subsidiaries.push(subs);
          }
        }
      }

      person = {
        nombre: personName,
        apellido_paterno: personMiddleName,
        apellido_materno: personLastName,
        sucursal: subsidiaries,
        foto: personAvatarUrl,
        permissions: userPermissions,
      };

      let response = await writePerson(person);

      if (personAvatar) personAvatarUrl = await writeBlob(personAvatar);

      let passwordObject = generatePasswordHash(userData.password);
      const dateCreate = new Date();

      let userToWrite = {
        dateCreate,
        email: userData.email,
        is_active: true,
        last_access: null,
        last_modify: null,
        password: passwordObject,
        person_id: response["_id"],
        username: userData.username,
      };

      let user = await writeUser(userToWrite);

      response["user"] = user;

      delete response.user.password;

      context.res = {
        status: 201,
        body: response,
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    } catch (error) {
      if (error.body) {
        context.res = error;
        context.done();
      }
      context.res = {
        status: 500,
        body: error.toString(),
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    }

    // Internal Functions

    async function searchSubsidiary(subsidiaryId) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("subsidiaries")
            .findOne(
              { _id: mongodb.ObjectId(subsidiaryId) },
              function (error, docs) {
                if (error) {
                  reject({
                    status: 500,
                    body: error,
                    headers: { "Content-Type": "application/json" },
                  });
                  return;
                }
                if (!docs) {
                  reject({
                    status: 400,
                    body: "AU-003",
                    headers: { "Content-Type": "application/json" },
                  });
                }
                resolve(docs);
              }
            );
        } catch (error) {
          context.log(error);
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function validate() {
      // check person names
      if (!personName || !personMiddleName) {
        context.res = {
          status: 400,
          body: "AU-004",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      // check object userData
      if (!userData) {
        context.res = {
          status: 400,
          body: "AU-005",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      // check fields in userData
      if (!userData.username || !userData.email || !userData.password) {
        context.res = {
          status: 400,
          body: "AU-006",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      // check is email is valid
      if (!validator.isEmail(userData.email)) {
        context.res = {
          status: 400,
          body: "AU-007",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      // check password length
      if (userData.password.length < 6) {
        context.res = {
          status: 400,
          body: "AU-008",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      // search user by email
      let query = { email: userData.email };
      const user = await searchUser(query);
      if (user) {
        context.res = {
          status: 400,
          body: "AU-009",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      // search user by user_name
      query = { username: userData.username };
      const userbyName = await searchUser(query);
      if (userbyName) {
        context.res = {
          status: 400,
          body: "AU-010",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
    }

    async function writeBlob(base64String) {
      //Local imports
      const { BlobServiceClient } = require("@azure/storage-blob");
      global.atob = require("atob");
      global.Blob = require("node-blob");
      const b64toBlob = require("b64-to-blob");
      const { AbortController } = require("@azure/abort-controller");
      const containerName = "person-avatar";

      var base64Data = base64String.split(";base64,").pop();
      var contentType = base64String
        .split(";base64,")
        .shift()
        .replace("data:", "");
      var fileFormat = contentType.split("/").pop();
      var blobName = containerName + new mongodb.ObjectID() + "." + fileFormat;
      var storageUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;

      try {
        var blobImage = b64toBlob(base64Data, contentType);

        var blobServiceClient = await BlobServiceClient.fromConnectionString(
          AZURE_STORAGE_CONNECTION_STRING
        );
        var containerClient = await blobServiceClient.getContainerClient(
          containerName
        );

        var blobClient = await containerClient.getBlobClient(blobName);
        var blockBlobClient = await blobClient.getBlockBlobClient();
        var aborter = AbortController.timeout(10 * ONE_MINUTE);
        await blockBlobClient.upload(blobImage.buffer, blobImage.size, aborter);
        return storageUrl + "/" + containerName + "/" + blobName;
      } catch (e) {
        throw new Error({
          status: 500,
          body: e.toString(),
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    async function writePerson(person) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("profiles")
            .insertOne(person, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
                return;
              }
              resolve(docs.ops[0]);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function writeUser(user) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("usuarios")
            .insertOne(user, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
                return;
              }
              resolve(docs.ops[0]);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    function generatePasswordHash(userpassword) {
      const salt = bcrypt.genSaltSync();
      return bcrypt.hashSync(userpassword, salt);
    }

    function searchUser(query) {
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .findOne(query, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
                return;
              }
              resolve(docs);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }
  }

  async function PUT_user() {
    // get variables from body
    let password = req.body["password"];
    let username = req.body["username"];
    let email = req.body["email"];
    validate();
    try {
      if (req.query["id"]) {
        let query = { _id: mongodb.ObjectID(req.query["id"]) };

        const date = new Date();

        let userToWrite = {
          last_modify: date,
        };
        if (password) {
          userToWrite["password"] = generatePasswordHash(password);
        }
        if (email) {
          userToWrite["email"] = email;
        }
        if (username) {
          userToWrite["username"] = username;
        }
        let updateResponse = await updateUser(userToWrite, query);
        if (!updateResponse.ops) {
          context.res = {
            status: 200,
            body: updateResponse,
            headers: { "Content-Type": "application/json" },
          };
        } else {
          context.res = {
            status: 200,
            body: updateResponse.ops[0],
            headers: { "Content-Type": "application/json" },
          };
        }
      } else {
        throw (context.res = {
          status: 404,
          body: "AU-001",
          headers: { "Content-Type": "application/json" },
        });
      }
      context.done();
    } catch (error) {
      if (error.status) {
        context.res = error;
      } else {
        context.res = {
          status: 500,
          body: error.toString(),
          headers: { "Content-Type": "application/json" },
        };
      }
      context.done();
    }

    // internal functions
    async function validate() {
      if (email && !validator.isEmail(email)) {
        context.res = {
          status: 400,
          body: "AU-006",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      if (password && password.length < 6) {
        context.res = {
          status: 400,
          body: "AU-009",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      // search user by email
      if (email) {
        let query = { email };
        const user = await searchUser(query);
        if (user) {
          context.res = {
            status: 400,
            body: "AU-009",
            headers: { "Content-Type": "application/json" },
          };
          context.done();
        }
      }
      // search user by user_name
      if (username) {
        let query = { username };
        const user = await searchUser(query);
        if (user) {
          context.res = {
            status: 400,
            body: "AU-010",
            headers: { "Content-Type": "application/json" },
          };
          context.done();
        }
      }
    }

    function generatePasswordHash(userpassword) {
      const salt = bcrypt.genSaltSync();
      return bcrypt.hashSync(userpassword, salt);
    }

    function searchUser(query) {
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .findOne(query, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
                return;
              }
              resolve(docs);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }

    async function updateUser(options, query) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .updateOne(query, { $set: options }, function (error, docs) {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
                return;
              }
              resolve(docs);
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: { "Content-Type": "application/json" },
          });
        }
      });
    }
  }

  function notAllowed() {
    context.res = {
      status: 405,
      body: "Method not allowed",
      headers: { "Content-Type": "application/json" },
    };
    context.done();
  }

  function createMongoClient() {
    return new Promise(function (resolve, reject) {
      if (mongo_client) resolve();
      mongodb.MongoClient.connect(
        connection_mongoDB,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
        function (error, _mongo_client) {
          if (error) reject(error);
          mongo_client = _mongo_client;
          resolve();
        }
      );
    });
  }
};
