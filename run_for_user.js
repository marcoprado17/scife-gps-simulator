// Obtenção das dependências
const Web3 = require('web3');
const secrets = require('./secrets');
const HDWalletProvider = require('truffle-hdwallet-provider');
const SmartCarInsuranceContract = 
require('./ethereum/build/SmartCarInsuranceContract.json');
const configs = require('./configs');
const Tx = require('ethereumjs-tx');
const bip39 = require("bip39");
const hdkey = require('ethereumjs-wallet/hdkey');
const crypto = require('crypto');
const fs = require('fs');

// Obtenção do indice que representa esse usuário
const user_idx = parseInt(process.argv[2]);

// Obtenção do Provider que será utilizado pela lib web3js para 
// comunicação com o nó Ethereum remoto por meio do Infura
const provider = new HDWalletProvider(
    secrets.mnemonic,
    secrets.infuraUrl,
    user_idx
);

const privKeyBuffer = provider.wallet._privKey;
const accountAddress = provider.address;
const web3 = new Web3(provider);
// Obtenção do contrato
const smartCarInsuranceContract = 
new web3.eth.Contract(
    JSON.parse(SmartCarInsuranceContract.interface), configs.contractAddress);

let nTransactions = 0;

// Obtenção da latitude e longitude inicial
let currentLat = configs.minInitialLat + 
    (configs.maxInitialLat-configs.minInitialLat)*Math.random();
let currentLong = configs.minInitialLong + 
    (configs.maxInitialLong-configs.minInitialLong)*Math.random();

// Obtenção da Hierarchical Deterministic wallet a partir do 
// mnemônico que gerará a seed
const masterSeed = bip39.mnemonicToSeed(secrets.gpsMnemonic);
const gpsHdwallet = hdkey.fromMasterSeed(masterSeed);

// Configurações iniciais do objeto que representa o relatório
let report = {};
report.configs = configs;
report.data = [];

let initialNonce = 0;

// Função que converte uma array de bytes para uma string em hexadecimal 
let decodeHexStringToByteArray = function(hexString) {
    // console.log(hexString);
    var result = [];
    while (hexString.length >= 2) { 
        result.push(parseInt(hexString.substring(0, 2), 16));
        hexString = hexString.substring(2, hexString.length);
    }
    // console.log(result);
    return result;
};

(async function(){
    initialNonce = await web3.eth.getTransactionCount(accountAddress);

    console.log(`initialNonce: ${initialNonce}`);

    // Aguardando certo intervalo de tempo para começar a enviar 
    //os dados do gps
    setTimeout(() => {
    // Enviando os dados do GPS a cada 
    // configs.sendLocationPeriodInMiliseconds milisegundos
    setInterval(async () => {
    try {
        // Incrmentando a transação
        let thisTransaction = nTransactions++;

        // Obtendo o Unix Timestamp atual em segundos
        const currentUnixTimestamp = Math.floor(Date.now()/1000);

        // Obtendo a latitude e longitude dessa iteração
        latLongData = {
            lat: currentLat,
            long: currentLong
        }

        // Setando a latitude e longitude da próxima iteração
        currentLat += (Math.random() > 0.5 ? 1 : -1)*
        Math.random()*configs.maxCoordinateDeltaBetweenCalls;
        currentLong += (Math.random() > 0.5 ? 1 : -1)*
        Math.random()*configs.maxCoordinateDeltaBetweenCalls;

        let thisLat = currentLat;
        let thisLong = currentLong;

        // Obtendo o indice da chave privada filha que será 
        // utilizada para encriptar o sinal GPS dessa iteração
        const i = currentUnixTimestamp-946684800;
        const key = gpsHdwallet
        .deriveChild(i).getWallet().getPrivateKey();

        // Encriptando os dados do GPS com AES256
        const cipher = crypto.createCipher("aes256", key)
        let encryptedGpsData = cipher.update(
            JSON.stringify(latLongData),'utf8','hex'
        );
        encryptedGpsData += cipher.final('hex');

        // Obtendo os dados da transação Ethereum que será 
        // utilizado para chamar a função do nosso contrato 
        // que recebe o sinal GPS
        const data = smartCarInsuranceContract.methods
            .pushGpsData(currentUnixTimestamp, encryptedGpsData)
            .encodeABI();
        let dataAsByteArray = decodeHexStringToByteArray(
            data.substr(2)
        );
        let nNonZeroBytes = 0;
        let nZeroBytes = 0;
        dataAsByteArray.map((byte) => {
            if(byte == 0){
                nZeroBytes++;
            }
            else{
                nNonZeroBytes++;
            }
        });
        // console.log(`nZeroBytes: ${nZeroBytes}`);
        // console.log(`nNonZeroBytes: ${nNonZeroBytes}`);

        const nonce = initialNonce + thisTransaction;

        // Setando os dados da transação
        const txData = {
            nonce: web3.utils.toHex(nonce),
            gasLimit: web3.utils.toHex(1000000),
            gasPrice: web3.utils.toHex(1e9), // 1 Gwei
            to: configs.contractAddress,
            from: accountAddress,
            data: data
        };

        // console.log(txData);

        // Assinando a transação com a chave privada
        const transaction = new Tx(txData);
        transaction.sign(privKeyBuffer);
        const serializedTx = transaction.serialize().toString('hex');
        const sendTxUnixTimestamp = Math.floor(Date.now()/1000);
        web3.eth.sendSignedTransaction('0x' + serializedTx)
            .once('transactionHash', function(hash) {
                console.log(hash);
            })
            .on('error', function(err) {
                // Adicionando os dados dessa transação mal 
                // sucedida ao relatório

                let msg = "";
                msg += `Sending transaction ${thisTransaction}/${nonce} 
                for user ${user_idx} (${accountAddress}) at 
                ${currentUnixTimestamp}\n`;
                msg += `ERROR: ${err.message}`;
                console.log(msg);

                const finishTxUnixTimestamp = Math.floor(Date.now()/1000);
                report.data.push({
                    idx: thisTransaction,
                    status: "ERROR",
                    message: err.message,
                    creationUnixTimestamp: currentUnixTimestamp,
                    lat: thisLat,
                    long: thisLong,
                    encryptedGpsData: encryptedGpsData,
                    sendTxUnixTimestamp: sendTxUnixTimestamp,
                    finishTxUnixTimestamp: finishTxUnixTimestamp,
                    latency: (finishTxUnixTimestamp-sendTxUnixTimestamp),
                    txData: txData,
                    nNonZeroBytes: nNonZeroBytes,
                    nZeroBytes: nZeroBytes
                });
            })
            .then(function(result) {
                // Adicionando os dados dessa transação bem 
                // sucedida ao relatório

                let msg = "";
                msg += `Sending transaction ${thisTransaction}/${nonce} 
                for user ${user_idx} (${accountAddress}) at 
                ${currentUnixTimestamp}\n`;
                msg += `SUCCESS:\n`;
                msg += `${JSON.stringify(result, null, 4)}`;
                console.log(msg);

                const finishTxUnixTimestamp = Math.floor(Date.now()/1000);
                report.data.push({
                    idx: thisTransaction,
                    status: "OK",
                    creationUnixTimestamp: currentUnixTimestamp,
                    lat: thisLat,
                    long: thisLong,
                    encryptedGpsData: encryptedGpsData,
                    sendTxUnixTimestamp: sendTxUnixTimestamp,
                    finishTxUnixTimestamp: finishTxUnixTimestamp,
                    latency: (finishTxUnixTimestamp-sendTxUnixTimestamp),
                    txData: txData,
                    result: result,
                    nNonZeroBytes: nNonZeroBytes,
                    nZeroBytes: nZeroBytes
                });
            });
    }
    catch(err){
        console.error(err);
    }
    }, configs.sendLocationPeriodInMiliseconds);
    }, Math.random() * configs.sendLocationPeriodInMiliseconds);
}());

// Enviando para um arquivo .json os dados do relatório 
// a cada 15 segundos
setInterval(function(){
    const currentUnixTimestamp = Math.floor(Date.now()/1000);
    console.log(`Saving report (${currentUnixTimestamp}.json)...`);
    let stringfiedReport = JSON.stringify(report, null, '\t');
    console.log("report.data.length", report.data.length);
    console.log("Report stringfied");
    // console.log(stringfiedReport);
    fs.writeFileSync(
        `./temp_reports/${currentUnixTimestamp}.json`, 
        stringfiedReport, 'utf-8'
    );
    console.log(`Report ${currentUnixTimestamp}.json saved`);
}, 15000);
