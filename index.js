#!/usr/bin/env node

var _ = require("underscore")
    , fs = require('fs')
    , _s = require("underscore.string")
    , argv = require('optimist').argv
    , colors = require('colors')
    , spawn = require('child_process').spawn
    , Table = require('cli-table')
    , readline = require('readline')
    , util = require("util")
    , request = require("request")
    , $ = require("jquery")
    , Browser = require('zombie')
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


var projectRoot = '/Volumes/www';
var vps = 'daniel.vivid';

var projectPaths = fs.readdirSync(projectRoot);
var projects = _.filter(projectPaths, function(path){
    if(!_(path).startsWith('.')) return path;
})

var projectTable = new Table({
    head: ['Index', 'Project', 'A'],
    colWidths: [20,50,10]
})
_.each(projects, function(project, i){
    projectTable.push([i, project, 'null'])
})

var directory = argv.d ? argv.d : (argv.p ? projectRoot+'/'+argv.p : __dirname);

var activeProject = argv.p ? argv.p : 'local';

rl.setPrompt('VIVID WEBCLI '+activeProject+' > ');
rl.prompt({preserveCursor:false});

function gitHub(argv, callback) {
    if(!argv[1]) return callback(['No input file specified'], null);
    var grep;
    var args = _.rest(argv, 2);
    console.log('Query GIT \n' .yellow);
    switch(argv[1]) {
        case "s":
        grep = spawn('git', ['--git-dir='+directory+'/.git', '--work-tree='+directory,'status']);
        case "log":
        grep = spawn('git', ['--git-dir='+directory+'/.git', '--work-tree='+directory,'log', (args.length) ? args.toString() : '--all']);
        break;
        default:
            console.log('Unknown command');
            return rl.prompt();
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
    if(!keyword) return callback(['No input file specified'], null);

    var table = new Table({
        head: ['Filename', 'Code', 'Line'],
        colWidths: [70,100,20]
    })

    var grep = spawn('git', ['--git-dir='+directory+'/.git', '--work-tree='+directory,'grep','--line-number' , keyword]);
    util.puts("\nSearching for Code: "+keyword .cyan.bold+" IN "+directory .cyan.bold +"\n");
    grep.stdout.on('data', function(data){
        var array = data.toString().split('\n');
        _.map(array, function(obj){
            if(!_(obj).isEmpty()) {
                var codeAndLine = _(obj).strRight(':');
                var code = _(codeAndLine).strRight(':');
                var line = _(codeAndLine).strLeft(':');
                var fileName = _(obj).strLeft(':');
                return table.push([fileName, _.trim(code), line]);
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
    if(!keyword) return callback(['No input file specified'], null);

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
        case "exit":
            process.exit(0);
        break;
        case "ld":
            console.log(directory .magenta);
            return rl.prompt();
        break;
        case "del":
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

            var isValidProject = _.find(projects, function(project){
                return project === kw[1];
            })

            if(!isValidProject) {
                console.log("\n");
                console.log('Project not found'.red);

                var regex = new RegExp(kw[1]);

                var suggestions = _.filter(projects, function(project){
                    return regex.test(project);
                })
                console.log("\n");
                console.log('Maybe you did look for:' .underline);
                _.each(suggestions, function(suggestion){
                    console.log(suggestion .magenta);
                })

                console.log("\n");
                return rl.prompt();
            }

            activeProject = kw[1];
            rl.setPrompt('VIVID WEBCLI '+activeProject+' > ');

            console.log("\n");
            console.log('Project changed to: '+_.capitalize(kw[1]) .green);
            console.log('Directory changed to '+argv.d .magenta);
            console.log("\n");
            return rl.prompt();
        break;
        case "find":
            lister(kw[1], function(err, response){
                if(err) {
                    console.log(err.toString() .red)
                }
                console.log("\n");
                rl.prompt();
            })
        break;
        case "grep":
            finder(kw[1], function(err, response){
                if(err) {
                    console.log(err.toString() .red)
                }
                console.log("\n");
                rl.prompt();
            })
        break;
        case "git":
            gitHub(kw, function(err, response){
                if(err) {
                    console.log(err.toString() .red)
                }
                console.log("\n");
                rl.prompt();
            })
        break;
        case "cp":
            console.log(projectTable.toString());
            console.log('\n');
            rl.question('Please select a project by its index > ', function(answer){
                if(_(answer).isBlank()) return rl.prompt();

                if(_.isNaN(_(answer).toNumber())) {
                    console.log('Not a Number, aborting .. ' .red);
                    return rl.prompt();
                }

                var index = _(answer).toNumber();
                activeProject = projects[index];
                argv.d = projectRoot+'/'+activeProject;
                directory = projectRoot+'/'+activeProject;
                rl.setPrompt('VIVID WEBCLI '+activeProject+' > ');

                return rl.prompt();
            })

        break;
        case "send":
            io.sockets.emit('com', {command: kw[1], message: _.rest(kw, 2)});
            rl.prompt();
        break;
        case "lp":
            var activeProjects = _.filter(projects, function(project){ return !_(project).startsWith('.');})
            var pt = new Table({
                head: ['Index', 'Project Name'],
                colWidths: [30,80]
            })
            var done = _.map(activeProjects, function(project, i){
                return pt.push([i+1, project])
            })
            console.log("\n");
            if(done) {
                console.log(pt.toString());
            }
            console.log("\n");
            rl.prompt();
        break;
        case "sh":
            fs.readFile(directory+'/'+kw[1], "UTF8", function(err, data){
                console.log('OUTPUT FILE: '+directory+'/'+kw[1]);
                console.log(data);
                console.log('\n');
                rl.prompt();
            });
        break;
        case "dom":
            var toServer = kw[1] ? kw[1] : 'http://'+activeProject+'.'+vps;
            if(!_(toServer).startsWith('http')){
                toServer = 'http://'+toServer;
            }
            console.log('Query: '+toServer);
            request(toServer, function(err, response, body){
                var string = body.toString();
                console.log(string.length);
                console.log('\n\n')
                return rl.prompt();
            })
        break;
        case "help":
            console.log('\n');
            console.log('TinyCodeCLI Help :) ' .magenta);
            console.log('\n');
            console.log('grep [keywords] -> git grep (searches active project code for keywords)');
            console.log('find [keywords] -> find (searches active project tree for files)');
            console.log('del [keywords] -> delete (shows files in table to select for deletion)');
            console.log('cd [project] -> changes project directory');
            console.log('lp -> lists active projects');
            console.log('ld -> console log active directory');
            console.log('sh [relative path and filename] -> prints out source code');
            console.log('git [command] [args] -> git on current folder');
            console.log('s [command] -> socket emit (UNDER CONSTRUCTION)');
            console.log('\n');
            return rl.prompt();
        break;
        case "sb":

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
