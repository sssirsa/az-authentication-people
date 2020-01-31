const mongodb = require('mongodb');
let mongo_client = null;

const connection_mongoDB = process.env["connection_mongoDB"];
const MONGO_DB_NAME = process.env['MONGO_DB_NAME'];

const bcrypt = require('bcrypt');
const saltRounds = 8;

const AZURE_STORAGE_CONNECTION_STRING = process.env['AUTH_AZURE_STORAGE_CONNECTION_STRING'];
const STORAGE_ACCOUNT_NAME = process.env['AZURE_STORAGE_ACCOUNT_NAME'];
const ONE_MINUTE = 60 * 1000;

module.exports = function (context, req) {
    switch (req.method) {
        case "GET":
            GET_person();
            break;
        case "POST":
            POST_person();
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

    async function GET_person() {
        var requestedID;
        if (req.query) {
            requestedID = req.query["id"];
        }
        try {
            if (requestedID) {
                let person = await getPerson(requestedID);
                context.res = {
                    body: person,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            else {
                let people = await getPeople();
                context.res = {
                    body: people,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
        }
        catch (error) {
            context.res=error;
            context.done();
        }
        async function getPerson(id) {
            await createMongoClient();
            return new Promise(function (resolve, reject) {
                try {
                    mongo_client
                        .db(MONGO_DB_NAME)
                        .collection('profiles')
                        .findOne({ _id: mongodb.ObjectID(id) },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error,
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                }
                                if (docs) {
                                    resolve(docs);
                                }
                                else {
                                    reject({
                                        status: 404,
                                        body: {},
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                }
                            }
                        );
                }
                catch (error) {
                    context.log(error);
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application/json'
                        }
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
                        .collection('profiles')
                        .find()
                        .toArray(function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                });
                            }
                            if (docs) {
                                resolve(docs);
                            }
                            else {
                                reject({
                                    status: 404,
                                    body: {},
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                });
                            }
                        });
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                }
            });
        }
    }

    async function POST_person() {
        let person;
        var personSubsidiaryId = req.body['sucursal'];
        var personAgencyId = req.body['udn'];
        let personName = req.body['nombre'];
        let personMiddleName = req.body['apellido_paterno'];
        let personLastName = req.body['apellido_materno'];
        let personAvatar = req.body['foto'];
        let userData = req.body['user'];
        let userPermissions = req.body['permissions'];
        validate();

        try {
            let personAgency, personSubsidiary, personAvatarUrl;

            if (personAgencyId) {
                personAgency = await searchAgency(personAgencyId);
            }
            if (personSubsidiaryId) {
                personSubsidiary = await searchSubsidiary(personSubsidiaryId);
            }
            if (personAvatar) {
                personAvatarUrl = await writeBlob(personAvatar);
            }

            let passwordHash = await generatePasswordHash(userData.password);

            let userToWrite = {
                username: userData.username,
                email: userData.email,
                password: passwordHash,
                is_active: true
            };

            let user = await writeUser(userToWrite);

            person = {
                nombre: personName,
                apellido_paterno: personMiddleName,
                apellido_materno: personLastName,
                sucursal: personSubsidiary,
                udn: personAgency,
                foto: personAvatarUrl,
                permissions: userPermissions,
                user: user
            };

            let response = await writePerson(person);

            context.res = {
                status: 201,
                body: response,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
            context.done();

        }
        catch (error) {
            context.res = error;
            context.done();
        }

        //Internal functions        
        async function searchAgency(agencyId) {
            await createMongoClient();
            return new Promise(function (resolve, reject) {
                try {
                    mongo_client
                        .db(MONGO_DB_NAME)
                        .collection('agencies')
                        .findOne({ _id: mongodb.ObjectId(agencyId) },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error,
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                    return;
                                }
                                if (!docs) {
                                    reject({
                                        status: 400,
                                        body: {
                                            message: 'ES-045'
                                        },
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
        async function searchSubsidiary(subsidiaryId) {
            await createMongoClient();
            return new Promise(function (resolve, reject) {
                try {
                    mongo_client
                        .db(MONGO_DB_NAME)
                        .collection('subsidiaries')
                        .findOne({ _id: mongodb.ObjectId(subsidiaryId) },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error,
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                    return;
                                }
                                if (!docs) {
                                    reject({
                                        status: 400,
                                        body: {
                                            message: 'ES-043'
                                        },
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
        function validate() {
            if (personAgencyId && personSubsidiaryId) {
                //User can not be in a subsidiary and an agency
                context.res = {
                    status: 400,
                    body: {
                        message: 'AU-001'
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            if (!personName || !personMiddleName) {
                context.res = {
                    status: 400,
                    body: 'Required fields: "nombre", "apellido_paterno"',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            if (!userData) {
                context.res = {
                    status: 400,
                    body: {
                        message: 'AU-002'
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            if (!userData.username || !userData.email || !userData.password) {
                context.res = {
                    status: 400,
                    body: 'Required user fields: "username", "password", "email"',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
        }
        async function writeBlob(base64String) {
            //Local imports
            const {
                BlobServiceClient
            } = require('@azure/storage-blob');
            global.atob = require('atob');
            global.Blob = require('node-blob');
            const b64toBlob = require('b64-to-blob');
            const { AbortController } = require('@azure/abort-controller');
            const containerName = 'person-avatar';

            var base64Data = base64String.split(';base64,').pop();
            var contentType = base64String.split(';base64,').shift().replace('data:', '');
            var fileFormat = contentType.split('/').pop();
            var blobName = containerName + new mongodb.ObjectID() + '.' + fileFormat;
            var storageUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;

            try {
                var blobImage = b64toBlob(base64Data, contentType);

                var blobServiceClient = await BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
                var containerClient = await blobServiceClient.getContainerClient(containerName);

                var blobClient = await containerClient.getBlobClient(blobName);
                var blockBlobClient = await blobClient.getBlockBlobClient();
                var aborter = AbortController.timeout(10 * ONE_MINUTE);
                await blockBlobClient.upload(blobImage.buffer, blobImage.size, aborter);
                return storageUrl + '/' + containerName + '/' + blobName;
            }
            catch (e) {
                throw new Error({
                    status: 500,
                    body: e.toString(),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
        async function writePerson(person) {
            await createMongoClient();
            return new Promise(function (resolve, reject) {
                try {
                    mongo_client
                        .db(MONGO_DB_NAME)
                        .collection('profiles')
                        .insertOne(person, function (error, docs) {
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
                            resolve(docs.ops[0]);
                        });
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application/json'
                        }
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
                        .collection('users')
                        .insertOne(user, function (error, docs) {
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
                            resolve(docs.ops[0]);
                        });
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }
            });
        }
        function generatePasswordHash(password) {
            return new Promise(function (resolve, reject) {
                bcrypt.hash(password, saltRounds, function (err, hash) {
                    if (err) {
                        reject(err);
                    }
                    if (hash) {
                        resolve(hash);
                    }
                });
            });

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

}
