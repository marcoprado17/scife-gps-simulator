const spawn = require('child_process').spawn;
// Obtendo o arquivo de configurações
const configs = require('./configs');

[...Array(configs.nUsers).keys()].map(user_idx => {
    // Iniciando um processo que executa o script run_for_user.js
    let command = spawn("node", ["run_for_user.js", user_idx]);
    
    // Imprimindo o stout dos processos filhos no processo mãe
    command.stdout.on('data', function (data) {
        process.stdout.write(data.toString());
    });
    
    // Imprimindo o stderr dos processos filhos no processo mãe
    command.stderr.on('data', function (data) {
        console.log("*** STDERR ***");
        process.stdout.write(data.toString());
    });
    
    // Imprimindo no processo mãe, os processos filhos que finalizaram
    command.on('exit', function (code) {
        console.log('child process exited with code ' + code.toString());
    });
});
