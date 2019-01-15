var _ = require('underscore');

// Keep track of which names are used so that there are no duplicates
var userNames = (function () {
  var names = {};
  var nameRestriction = /(^[\[\]a-zA-Z0-9_-]{3,16})$/;

  // id allows for "private messages"
  var claim = function (name, id) {
    if (!name || name in names) {
      return false;
    } else {
      if (nameRestriction.test(name)) {
        names[name] = id;
        return true;
      }
      return false;
    }
  };

  // find the lowest unused "guest" name and claim it
  var getGuestName = function (id) {
    var name,
      nextUserId = 1;

    do {
      name = 'Guest' + nextUserId;
      nextUserId += 1;
    } while (!claim(name, id));

    return name;
  };

  // serialize claimed names as an array
  var get = function () {
    var res = [];
    for (user in names) {
      res.push(user);
    }

    return res;
  };

  var getId = function(name) {
    return names[name];
  };

  var free = function (name) {
    if (names[name]) {
      delete names[name];
    }
  };

  return {
    claim: claim,
    free: free,
    get: get,
    getId: getId,
    getGuestName: getGuestName
  };
}());

// export function for listening to the socket
module.exports = function (io, socket) {
  var name = userNames.getGuestName(socket.id);

  // send the new user their name and a list of users
  socket.emit('init', {
    name: name,
    users: userNames.get()
  });

  // notify other clients that a new user has joined
  socket.broadcast.emit('user:join', {
    name: name
  });

  // broadcast a user's message to other users
  socket.on('send:message', function (data, callback) {
    escapeMsg = _.escape(data.message);
    socket.broadcast.emit('send:message', {
      user: name,
      text: escapeMsg
    });
    callback(escapeMsg);
  });

  // validate a user's name change, and broadcast it on success
  socket.on('change:name', function (data, fn) {
    if (userNames.claim(data.name, socket.id)) {
      var oldName = name;
      userNames.free(oldName);
      name = data.name;

      socket.broadcast.emit('change:name', {
        oldName: oldName,
        newName: name
      });

      fn(true);
    } else {
      fn(false);
    }
  });

  // /me message
  socket.on('send:action', function(data, callback) {
    socket.broadcast.emit('send:action', {
      user: name,
      text: _.escape(data.message)
    });
    callback(_.escape(data.message));
  });

  // /msg [username] message
  socket.on('send:private', function(data, callback) {
    var userId = userNames.getId(data.nick);
    if(_.isUndefined(userId)) {
      callback({error: true});
    } else {
      io.sockets.socket(userNames.getId(data.nick)).emit('send:private', {
        user: data.nick,
        text: _.escape(data.message)
      });
      callback({error:false, text: _.escape(data.message)});
    }
  });

  // clean up when a user leaves, and broadcast it to other users
  socket.on('disconnect', function () {
    socket.broadcast.emit('user:left', {
      name: name
    });
    userNames.free(name);
  });
};
