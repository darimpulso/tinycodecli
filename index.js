#!/usr/bin/env node

var _ = require("underscore")
    , fs = require('fs')
    , _s = require("underscore.string")
    , argv = require('optimist').argv
    , colors = require('colors')
    , spawn = require('child_process').spawn
    , directory = argv.d ? argv.d : __dirname
    , Table = require('cli-table')
    , readline = require('readline')
    , util = require("util")
    , sigcount = 0

_.mixin(_s.exports());

var io = require('socket.io').listen(3800);

io.configure(function(){
  io.enable('browser client etag');
  io.set('log level', 1);

  io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});

io.sockets.on('connection', function (socket) {
  io.sockets.emit('this', { will: 'be received by everyone'});

  socket.on('message', function (from, msg) {
    console.log('I received a private message by ', from, ' saying ', msg);
  });

  socket.on('disconnect', function () {
    io.sockets.emit('user disconnected');
  });
});



rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('VIVID WEBCLI > ');
rl.prompt({preserveCursor:false});




var projectRoot = '/Volumes/www';

var projectPaths = fs.readdirSync(projectRoot);
var projects = _.filter(projectPaths, function(path){
    if(!path.match('^._')) return path;
})

var projectTable = new Table({
    head: ['Index', 'Project', 'A'],
    colWidths: [20,50,10]
})
_.each(projects, function(project, i){
    projectTable.push([i, project, null])
})


function gitHub(argv, callback) {
    var grep;
    switch(argv) {
        case "s":
        grep = spawn('git', ['--git-dir='+directory+'/.git', '--work-tree='+directory,'status']);
        break;
    }
    grep.stdout.on('data', function(data){
        console.log(data.toString());
    })

    grep.stderr.on('data', function(data){
        callback(data, null);
    })

    grep.on('close', function(){
        // if(table.length > 0) {
        //     console.log("\n");
        //     console.log(table.toString())
        // } else {
        //     console.log('No results .. '.magenta);
        // }
        // process.nextTick(function(){
        //     callback(null, 'done');
        // })
        callback(null, 'done');
    })
}

function finder(keyword, callback){
    var table = new Table({
        head: ['Filename', 'Line / Code'],
        colWidths: [60,100]
    })

    var grep = spawn('git', ['--git-dir='+directory+'/.git', '--work-tree='+directory,'grep', keyword]);
    util.puts("\nSearching for Code: "+keyword .cyan.bold+" IN "+directory .cyan.bold +"\n");
    grep.stdout.on('data', function(data){
        var array = data.toString().split('\n');
        _.map(array, function(obj){
            if(!_(obj).isEmpty()) {
                var code = _(obj).strRight(':');
                var fileName = _(obj).strLeft(':');
                return table.push([fileName, _.trim(code)]);
            }
        })
    })

    grep.stderr.on('data', function(data){
        callback(data, null);
    })

    grep.on('close', function(){
        if(table.length > 0) {
            console.log("\n");
            console.log(table.toString())
        } else {
            console.log('No results .. '.magenta);
        }
        process.nextTick(function(){
            callback(null, 'done');
        })
    })
}

function lister(keyword, callback) {
    var foundItems = [];

    var table = new Table({
        head: ['Index', 'File'],
        colWidths: [30,110]
    })

    var regexAll = /[^\\]*\.(\w+)$/;

    if(!keyword.match(regexAll)) {
        keyword = keyword+'*';
    }

    var find = spawn('find', [directory, '-name', keyword])
    var i = 0;
    util.puts("\nSearching for: "+keyword .cyan.bold+" IN "+directory .cyan.bold +"\n");
    find.stdout.on('data', function(data){
        var array = data.toString().split('\n');
        _.each(array, function(string){
            foundItems.push(string);
            if(!_(string).isBlank()) {
                i++;
                table.push([i, string]);
            }
        })
    })
    find.stderr.on('data', function(data){
        callback(data, null);
    })
    find.on('close', function(){
        if(table.length > 0) {
            console.log("\n");
            console.log(table.toString())
        } else {
            console.log('No results .. '.magenta);
        }
        callback(null, 'done');
    })
}

function remover(keyword, callback) {
    var foundItems = [];

    var table = new Table({
        head: ['Index', 'File'],
        colWidths: [30,80]
    })

    var regexAll = /[^\\]*\.(\w+)$/;

    if(!keyword.match(regexAll)) {
        keyword = keyword+'*';
    }

    var find = spawn('find', [directory, '-name', keyword])
    var i = 0;
    find.stdout.on('data', function(data){
        var array = data.toString().split('\n');
        _.each(array, function(string){
            foundItems.push(string);
            if(!_(string).isBlank()) {
                i++;
                table.push([i, string]);
            }
        })
    })
    find.stderr.on('data', function(data){
        callback(data, null);
    })

    find.on('close', function(){
        if(table.length > 0) {
            console.log("\n");
            console.log(table.toString())
        } else {
            console.log('No results .. '.magenta);
            return callback(null, 'done');
        }

        rl.question('How do you want to delete? [a(ll)/s(eperated)/c(ancel)]  >  ', function(answer){
            if(answer.match('a')) {
                var fi = 0;
                var count = _.size(foundItems);
                _.each(foundItems, function(foundItem){
                    fi++;
                    if(!_(foundItem).isBlank()) {
                        fs.unlink(foundItem, function(err){

                            if(err) {
                                console.error(err);
                            } else {
                                console.log('File '+foundItem+' deleted' .green.bold);
                                if(fi >= count) {
                                    callback(null, 'done');
                                }
                            }
                        })
                    }
                })
            } else if(answer.match('s')) {
                rl.question('Please enter the indexes seperated by [,] for deletion. [ex: 1,2,3]  >  ', function(remAnswer){
                    if(remAnswer.match(',')) {
                        var keys = _.words(remAnswer, ',');
                        var count = _.size(keys);
                        var fi = 0;
                        _.each(keys, function(key){
                            fi++;
                            fs.unlink(foundItems[parseInt(key)-1], function(err){
                                fi++;
                                if(err) {
                                    console.log(err.toSring() .red);
                                } else {
                                    console.log('File '+foundItems[parseInt(key)-1]+' deleted' .green.bold);
                                    if(fi >= count) {
                                        callback(null, 'done');
                                    }
                                }
                            })
                        })
                    } else {
                        var toDelete = foundItems[parseInt(remAnswer)-1];
                        console.log('You are about to delete '.bold +toDelete+''.magenta);
                        rl.question('Are you sure [y/n]', function(delAnswer){
                            if(delAnswer.match('y')) {
                                fs.unlink(toDelete, function(err){
                                    if(err) {
                                        console.log(err.toSring() .red);
                                    } else {
                                        console.log('File '+toDelete+' deleted' .green.bold);
                                        callback(null, 'done');
                                    }
                                })
                            } else if(delAnswer.match('n')) {
                                console.log('Aborting..' .magenta);
                                callback(null, 'done');
                            }
                        })
                    }
                })
            } else if(answer.match('c')) {
                process.nextTick(function(){
                    callback(null, 'done');
                })
            }
        })
    })
}


rl.on('line', function(line) {

    if(_(line).isBlank()) {
        return rl.prompt();
    }

    var kw = _.words(line);

    switch(kw[0]) {
        case "e":
            process.exit(0);
        break;
        case "d":
            remover(kw[1], function(err, response){
                if(err) {
                    console.log(err.toString() .red)
                }
                console.log("\n");
                rl.prompt();
            })
        break;
        case "cd":
            argv.d = projectRoot+'/'+kw[1];
            directory = projectRoot+'/'+kw[1];

            console.log("\n");
            console.log('Directory changed to '+argv.d .magenta);
            console.log("\n");
            return rl.prompt();
        break;
        case "f":
            lister(kw[1], function(err, response){
                if(err) {
                    console.log(err.toString() .red)
                }
                console.log("\n");
                rl.prompt();
            })
        break;
        case "g":
            finder(kw[1], function(err, response){
                if(err) {
                    console.log(err.toString() .red)
                }
                console.log("\n");
                rl.prompt();
            })
        break;
        case "q":
            gitHub(kw[1], function(err, response){
                if(err) {
                    console.log(err.toString() .red)
                }
                console.log("\n");
                rl.prompt();
            })
        break;
        case "cp":
        return rl.prompt();
            console.log(projectTable.toString());
        break;
        case "s":
            io.sockets.emit('com', {command: kw[1], message: _.rest(kw, 2)});
            rl.prompt();
        break;
        default:
            return rl.prompt();
    }


}).on('SIGINT', function() {
  sigcount++;
  if(sigcount >= 2){
        util.puts("Shutting down process ... " .cyan);
        util.puts("So long and thanks for the fish :) " .green.bold);
          process.exit(0);
  } else {
          util.puts("\nPlease press CTRL+D again to exit" .magenta)
  }
}).on("SIGCONT", function(){
    console.log("got sig");
    rl.prompt();
})
