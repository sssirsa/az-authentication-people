const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongodb = require("mongodb");

//? database environment variables
const connection_mongoDB = process.env["connection_mongoDB"];
const MONGO_DB_NAME = process.env["MONGO_DB_NAME"];
const SECRET_JWT_SEED = process.env["SECRET_JWT_SEED"];

let mongo_client = null;

module.exports = function (context, req) {
  switch (req.method) {
    case "POST":
      POST_login();
      break;
    default:
      notAllowed();
      break;
  }

  function notAllowed() {
    context.res = {
      status: 405,
      body: { code: "AU-017" },
      headers: { "Content-Type": "application/json" },
    };
    context.done();
  }

  //? HTTP Requests
  async function POST_login() {
    let { username: userName, password: userPassword } = req.body;

    try {
      const error = await validate();
      //! error in validation
      if (error) {
        context.res = error;
        context.done();
      }

      const user = await searchUser();
      //! password not match
      if (!bcrypt.compareSync(userPassword, user.password)) {
        context.res = {
          status: 401,
          body: { code: "AU-015" },
          headers: { "Content-Type": "application/json" },
        };
        context.done();
      }

      const access_token = await generateJWT(user._id, userName);
      const person = await searchPerson(user["person_id"].toString());
      const last_access = new Date();
      const userUpdate = { last_access };
      const query = { _id: mongodb.ObjectID(user._id) };
      await updateUser(userUpdate, query);

      //* success response
      const response = { access_token, person };
      context.res = {
        status: 200,
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

    //? Internal functions
    function validate() {
      if (!userName) {
        return {
          status: 400,
          body: { code: "AU-013" },
          headers: { "Content-Type": "application/json" },
        };
      }
      if (!userPassword) {
        return {
          status: 400,
          body: { code: "AU-014" },
          headers: { "Content-Type": "application/json" },
        };
      }
    }

    async function searchUser() {
      await createMongoClient();
      return new Promise((resolve, reject) => {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .findOne({ username: userName }, (error, docs) => {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
              }
              if (!docs) {
                reject({
                  status: 401,
                  body: { code: "AU-001" },
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

    async function searchPerson(personId) {
      await createMongoClient();
      return new Promise((resolve, reject) => {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("profiles")
            .findOne({ _id: mongodb.ObjectID(personId) }, (error, docs) => {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
                  headers: { "Content-Type": "application/json" },
                });
              }
              if (!docs) {
                reject({
                  status: 401,
                  body: { code: "AU-011" },
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

    async function updateUser(options, query) {
      await createMongoClient();
      return new Promise((resolve, reject) => {
        try {
          mongo_client
            .db(MONGO_DB_NAME)
            .collection("users")
            .updateOne(query, { $set: options }, (error, docs) => {
              if (error) {
                reject({
                  status: 500,
                  body: error.toString(),
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

    async function generateJWT(uid, name) {
      const payload = { uid, name };
      return new Promise((resolve, reject) => {
        jwt.sign(
          payload,
          SECRET_JWT_SEED,
          {
            expiresIn: "24h",
          },
          (error, token) => {
            error ? reject(error) : resolve(token);
          }
        );
      });
    }
  }

  //? Global functions
  async function createMongoClient() {
    return new Promise((resolve, reject) => {
      //* already mongo_client exists
      if (mongo_client) resolve();
      mongodb.MongoClient.connect(
        connection_mongoDB,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
        (error, _mongo_client) => {
          if (error) reject(error);
          mongo_client = _mongo_client;
          resolve();
        }
      );
    });
  }
};
