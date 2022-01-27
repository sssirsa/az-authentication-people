const mongodb = require("mongodb");
let mongo_client = null;

const connection_mongoDB =
  "mongodb+srv://devops:59LzYD00s3q9JK2s@cluster0-qrhyj.mongodb.net?retryWrites=true&w=majority";
const MONGO_DB_NAME = "management";

const validator = require("validator");

// constants environment
const AZURE_STORAGE_CONNECTION_STRING =
  process.env["AUTH_AZURE_STORAGE_CONNECTION_STRING"];
const STORAGE_ACCOUNT_NAME = process.env["AZURE_STORAGE_ACCOUNT_NAME"];

module.exports = function (context, req) {
  switch (req.method) {
    case "GET":
      GET_profile();
      break;
    case "POST":
      POST_profile();
      break;
    case "PUT":
      PUT_profile();
      break;
    default:
      notAllowed();
      break;
  }

  async function GET_profile() {
    let requestedID;
    if (req.query) requestedID = req.query["id"];
    try {
      if (requestedID) {
        let person = await getPerson(requestedID);
        context.res = {
          body: person,
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      } else {
        let people = await getPeople();
        context.res = {
          body: people,
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
    } catch (error) {
      context.res = error;
      context.done();
    }

    // Internal functions

    async function getPerson(id) {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("profiles_test")
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
              if (docs) {
                resolve(docs);
              } else {
                reject({
                  status: 404,
                  body: {},
                  headers: { "Content-Type": "application/json" },
                });
              }
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

    async function getPeople() {
      await createMongoClient();
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("profiles_test")
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
                  headers: {
                    "Content-Type": "application/json",
                  },
                });
              }
              if (docs) {
                resolve(docs);
              } else {
                reject({
                  status: 404,
                  body: {},
                  headers: {
                    "Content-Type": "application/json",
                  },
                });
              }
            });
        } catch (error) {
          reject({
            status: 500,
            body: error.toString(),
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
      });
    }
  }

  async function POST_profile() {
    let person;
    // get variables from body
    let personSubsidiaries = req.body["sucursal"];
    let personName = req.body["nombre"];
    let personMiddleName = req.body["apellido_paterno"];
    let personLastName = req.body["apellido_materno"];
    let personAvatar = req.body["foto"];
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

      context.res = {
        status: 201,
        body: response,
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    } catch (error) {
      context.res = {
        status: 500,
        body: error.toString(),
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    }

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
                    body: { message: "ES-043" },
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
      if (personSubsidiaries.length === 0) {
        //User can not be in a subsidiary and an agency
        context.res = {
          status: 400,
          body: { message: "AU-001" },
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      if (!personName || !personMiddleName) {
        context.res = {
          status: 400,
          body: 'Required fields: "nombre", "apellido_paterno"',
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
            .collection("profiles_test")
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
