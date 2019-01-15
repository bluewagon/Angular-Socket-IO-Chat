'use strict';

/* Controllers */

function AppCtrl($scope, socket) {
  $scope.glued = true;

  // templates
  var action_message = "<span class='action'>* %USERNAME% %MESSAGE%</span>";
  var regular_message = "<span class='username'>%USERNAME%</span>: %MESSAGE%";
  var announcement_message = "<span class='announcement'>--<span class='username'>%USERNAME%</span>-- %MESSAGE%</span>";
  var private_message = "<span class='privateMsg'>**<span class='username'>%USERNAME%</span>** %MESSAGE%</span>";
  var nameChange_message = "<span class='nameChange'>*** %OLDNAME% is now known as %NEWNAME%</span>";
  // Socket listeners
  // ================

  socket.on('init', function (data) {
    $scope.name = data.name;
    $scope.users = data.users;
  });

  socket.on('send:message', function (message) {
    $scope.messages.push(getMessage(regular_message, message));
  });

  socket.on('change:name', function (data) {
    changeName(data.oldName, data.newName);
  });

  socket.on('user:join', function (data) {
    $scope.messages.push(getMessage(announcement_message, {
      user: 'chatroom',
      text: 'User ' + data.name + ' has joined.'
    }));
    $scope.users.push(data.name);
  });

  socket.on('send:action', function(message) {
    $scope.messages.push(getMessage(action_message, message));
  });

  socket.on('send:private', function(message) {
    $scope.messages.push(getMessage(private_message, message));
  });

  // add a message to the conversation when a user disconnects or leaves the room
  socket.on('user:left', function (data) {
    $scope.messages.push(getMessage(announcement_message, {
      user: 'chatroom',
      text: 'User ' + data.name + ' has left.'
    }));
    var i, user;
    for (i = 0; i < $scope.users.length; i++) {
      user = $scope.users[i];
      if (user === data.name) {
        $scope.users.splice(i, 1);
        break;
      }
    }
  });

  // Private helpers
  // ===============

  var changeName = function (oldName, newName) {
    // rename user in list of users
    var i;
    for (i = 0; i < $scope.users.length; i++) {
      if ($scope.users[i] === oldName) {
        $scope.users[i] = newName;
      }
    }

    $scope.messages.push(getMessage, nameChange_message
        .replace('%OLDNAME%', oldName).replace('%NEWNAME%', newName)
    );
  };

  var getMessage = function(message_template, message) {
    return message_template.replace('%USERNAME%', message.user)
        .replace('%MESSAGE%', message.text);
  };

  // Methods published to the scope
  // ==============================

  $scope.changeName = function () {
    socket.emit('change:name', {
      name: $scope.newName
    }, function (result) {
      if (!result) {
        alert('There was an error changing your name');
      } else {
        changeName($scope.name, $scope.newName);

        $scope.name = $scope.newName;
        $scope.newName = '';
      }
    });
  };

  $scope.messages = [];

  var sendAction = function(message) {
    var action = message.substr(4);
    socket.emit('send:action', {
      message: action
    }, function(newMessage) {
      $scope.messages.push(getMessage(action_message, {
        user: $scope.name,
        text: newMessage
      }));
    });
  }

  var sendPrivateMessage = function(message) {
    var nick = message.split(" ")[1];
    socket.emit('send:private', {
      nick: nick,
      message: message.substr('/msg '.length + nick.length + 1)
    }, function(result) {
      if(result.error) {
        $scope.messages.push("Unable to send a message to that user");
      } else {
        $scope.messages.push(getMessage(private_message, {
          user: '-->' + nick,
          text: result.text
        }));
      }
    });
  }

  var sendNameChange = function(message) {
    var newName = message.split(" ")[1];
    socket.emit('change:name', {
      name: newName
    }, function(result) {
      if(!result) {
        $scope.messages.push("Unable to change to that name")
      } else {
        changeName($scope.name, newName);
        $scope.name = newName;
      }
    });
  }

  var sendHelp = function() {
    $scope.messages.push("<span class='help'>Commands for this chat: <br/>" +
      "/help for this menu <br/>" +
      "/me [message] to perform an action <br/>" +
      "/msg [username] [message] to send a private message <br/>" +
      "/name [newname] to change your name</span>");
  }

  var sendCommand = function(message) {
    if (message.indexOf('/me ') === 0) {
      sendAction(message);
    } else if (message.indexOf('/name ') === 0) {
      sendNameChange(message);
    } else if (message.indexOf('/msg ') === 0) {
      sendPrivateMessage(message);
    } else if (message.indexOf('/help') === 0) {
      sendHelp();
    }
  }

  $scope.sendMessage = function () {
    var message = $scope.message;
    if (message.indexOf('/') === 0) {
      sendCommand(message);
    } else {
      socket.emit('send:message', {
        message: $scope.message
      }, function(newMessage) {
        // add the message to our model locally
        $scope.messages.push(getMessage(regular_message, {
          user: $scope.name,
          text: newMessage
        }));
      });
    }
    // clear message box
    $scope.message = '';
  };

  var getMsgFocus = function() {
    $('#msg').focus();
  };

  $scope.nameChangeMsg = function() {
    $scope.message = '/name ENTER_NEW_NAME';
    getMsgFocus();
  };

  $scope.privateMsg = function(user) {
    if(typeof user === 'undefined') {
      user = 'USER';
    }
    $scope.message = '/msg ' + user + ' ENTER_MESSAGE';
    getMsgFocus();
  };

  $scope.actionMsg = function() {
    $scope.message = '/me ENTER_ACTION';
    getMsgFocus();
  };
}
