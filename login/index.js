const mongodb = require('mongodb');
let mongo_client = null;

const connection_mongoDB = process.env["connection_mongoDB"];
const MONGO_DB_NAME = process.env['MONGO_DB_NAME'];

const crypto = require('crypto');

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
            body: "Method not allowed",
            headers: {
                'Content-Type': 'application/json'
            }
        };
        context.done();
    }

    async function POST_login(){
        let userName=req.body['username'];
        let userPassword=req.body['password'];

        try{
            let user = await searchUser();
            if(validatePasswordHash(user.password.passwordData, userPassword)){
                context.res={
                    status:200,
                    headers:{
                        'Content-Type':'application/json'
                    }
                }
                context.done();
            }
            else{                
                context.res={
                    status:401,
                    body:'Invalid password',
                    headers:{
                        'Content-Type':'application/json'
                    }
                }
                context.done();
            }
        }
        catch(error){
            context.res = error;
            context.done();
        }

        //Internal functions
        async function searchUser(){
            await createMongoClient();
            return new Promise(function (resolve, reject) {
                try {
                    mongo_client
                        .db(MONGO_DB_NAME)
                        .collection('users')
                        .findOne({ username: userName },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                    return;
                                }
                                if (!docs) {
                                    reject({
                                        status: 401,
                                        body: 'Invalid username',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                }
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    context.log(error);
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                }
            });
        }

        function validatePasswordHash(passwordObject, passwordString) {
            let salt = passwordObject['salt'];
            let calculatedPassword = sha512(passwordString, salt);

            if(passwordObject.passwordHash===calculatedPassword.passwordHash){
                return true;
            }
            else{
                return false;
            }

            //Internal functions

            function sha512(password, salt) {
                var hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
                hash.update(password);
                var value = hash.digest('hex');
                return {
                    salt: salt,
                    passwordHash: value
                };
            };

        }
    }
    
    //Internal globals
    function createMongoClient() {
        return new Promise(function (resolve, reject) {
            if (!mongo_client) {
                mongodb.MongoClient.connect(connection_mongoDB, function (error, _mongo_client) {
                    if (error) {
                        reject(error);
                    }
                    mongo_client = _mongo_client;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }

};