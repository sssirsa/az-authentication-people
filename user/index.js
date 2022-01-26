const mongodb = require("mongodb");
let mongo_client = null;

const connection_mongoDB =
  "mongodb+srv://devops:59LzYD00s3q9JK2s@cluster0-qrhyj.mongodb.net?retryWrites=true&w=majority";
const MONGO_DB_NAME = "management";

const bcrypt = require("bcryptjs");

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

  function notAllowed() {
    context.res = {
      status: 405,
      body: "Method not allowed",
      headers: { "Content-Type": "application/json" },
    };
    context.done();
  }

  async function GET_user() {}

  async function POST_user() {
    let userData = req.body["user"];

    validate();

    try {
      let passwordObject = generatePasswordHash(userData.password);

      const dateCreate = new Date();

      let userToWrite = {
        dateCreate,
        email: userData.email,
        is_active: true,
        last_access: null,
        last_modify: null,
        password: passwordObject,
        username: userData.username,
      };

      const response = {};
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
      context.res = {
        status: 500,
        body: error.toString(),
        headers: { "Content-Type": "application/json" },
      };
      context.done();
    }

    // Internal Functions

    async function validate() {
      if (!userData) {
        context.res = {
          status: 400,
          body: { message: "AU-002" },
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      if (!userData.username || !userData.email || !userData.password) {
        context.res = {
          status: 400,
          body: 'Required user fields: "username", "password", "email"',
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
      const user = await searchUser(userData.email);
      if (user) {
        context.res = {
          status: 400,
          body: "The email already exists in other user",
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }
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

    function searchUser(email) {
      return new Promise(function (resolve, reject) {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .findOne({ email }, function (error, docs) {
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
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
      });
    }
  }

  async function PUT_user() {}

  function createMongoClient() {
    return new Promise(function (resolve, reject) {
      if (mongo_client) resolve();
      mongodb.MongoClient.connect(
        connection_mongoDB,
        function (error, _mongo_client) {
          if (error) reject(error);
          mongo_client = _mongo_client;
          resolve();
        }
      );
    });
  }
};
