const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const mongoose = require("mongoose");
const yts = require("yt-search");
const youtubeInfo = require("youtube-info");

const client = new Discord.Client();
const config = require("./config.json");
mongoose.set("useCreateIndex", true);

const UserModel = require("./models/user");
const MusicModel = require("./models/music");

let room = [];

client.on("ready", () => {
  const mongoConnect = mongoose.connect(config.mongodb, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  mongoConnect.then(() => console.log("MongoDB connected"));

  console.log(
    `Bot foi iniciado, com ${client.users.cache.size} usuários, em ${client.channels.cache.size} canais, em ${client.guilds.cache.size} servidores.`
  );

  client.user.setActivity("Waiting for fee");
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (message.channel.type === "dm") return;
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content
    .slice(config.prefix.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "channel") {
    const channelId = args.shift();

    const voiceChannel = message.guild.channels.cache.find(
      channel => channel.id === channelId
    );

    if (!voiceChannel) {
      message.channel.send(
        "I don't know this place, I think I'm without 4G on the GPS."
      );
    }

    await voiceChannel.join();

    message.channel.send(
      "Ok, just this time I'm going to charge no fee, a second... i'm turning on the notebook!"
    );

    return;
  }

  if (command === "next") {
    try {
      const sendId = message.author.id;
      const music = args.join(" ");

      let video;
      if (music.includes("youtube.com")) {
        video = await analysisMusics([{ url: music }]);
      } else {
        const search = await yts(music);
        if (search.videos.length < 1) {
          message.channel.send(
            "Oh no, it looks like I didn't find this song in my music folder."
          );

          return;
        }

        video = await analysisMusics(search.videos);
      }

      let user = await UserModel.findOne({ id: sendId });

      if (!user) {
        user = await UserModel.create({
          id: sendId
        });
      }

      if (!user.like) {
        user.like = [];
      }

      if (!user.like[video.url]) {
        user.like.push(video.url);

        await user.save();
      }

      message.channel.send(`I'll try to play ${video.title} for you.`);
    } catch (error) {
      console.log("next error: ", error);
    }

    return;
  }

  if (command === "skip") {
    const voiceChannel = message.member.voice.channel;

    if (!(room[voiceChannel.id] && room[voiceChannel.id].connection)) {
      await message.channel.send("Hold on, I'm not playing!");

      return;
    }

    room[voiceChannel.id].connection.dispatcher.end();

    return;
  }

  if (command === "dislike") {
    const sendId = message.author.id;

    let user = await UserModel.findOne({ id: sendId });

    if (!user) {
      user = await UserModel.create({
        id: sendId
      });
    }

    if (!user.dislike) {
      user.dislike = [];
    }

    const video = client.presence.activities[0].name;

    if (!video || !video.includes("youtube.com")) {
      message.channel.send(
        "I'm not even touching anything, you must be talking to the wrong person."
      );

      return;
    }

    if (!user.dislike[video]) {
      user.dislike.push(video);

      await user.save();
    }

    message.channel.send("Ah ok, I'll leave it marked here.");

    return;
  }

  if (command === "like") {
    const sendId = message.author.id;

    let user = await UserModel.findOne({ id: sendId });

    if (!user) {
      user = await UserModel.create({
        id: sendId
      });
    }

    if (!user.like) {
      user.like = [];
    }

    const video = client.presence.activities[0].name;

    if (!video || !video.includes("youtube.com")) {
      message.channel.send(
        "I'm not even touching anything, you must be talking to the wrong person."
      );

      return;
    }

    if (!user.like[video]) {
      user.like.push(video);

      await user.save();
    }

    message.channel.send("I know you like.");

    return;
  }

  if (command === "volume") {
    const voiceChannel = message.member.voice.channel;
    if (!room[voiceChannel.id]) {
      message.channel.send(
        "I'm not even touching anything, you must be talking to the wrong person."
      );

      return;
    }

    const volume = args.shift();

    if (isNaN(volume) || volume < 0 || volume > 100) {
      message.channel.send("Oh, right, sorry.");

      return;
    }

    room[voiceChannel.id].pickup.setVolume(volume / 100);
    room[voiceChannel.id].streamOptions.volume = volume / 100;

    return;
  }

  if (command === "stop") {
    const voiceChannel = message.member.voice.channel;
    if (!room[voiceChannel.id]) {
      message.channel.send(
        "I'm not even touching anything, you must be talking to the wrong person."
      );

      return;
    }

    room[voiceChannel.id]._musics = undefined;

    room[voiceChannel.id].connection.dispatcher.end();

    return;
  }

  if (command === "play") {
    const voiceChannel = message.member.voice.channel;

    if (!room[voiceChannel.id]) {
      room[voiceChannel.id] = {};
    }

    room[voiceChannel.id].streamOptions = config.streamOptions;

    if (!voiceChannel) {
      await message.channel.send(
        "I have no place to play :(, tell me a channel to go."
      );
      message.channel.send(
        "Help: send in text channel @dj channel 'voice channel id'"
      );

      return;
    }

    room[voiceChannel.id].connection = await voiceChannel.join();

    room[voiceChannel.id].play = selectMusics(
      voiceChannel,
      room[voiceChannel.id].connection
    );
  }
});

const selectMusics = async (voiceChannel, connection) => {
  const users = voiceChannel.members
    .filter(member => !member.user.bot)
    .map(member => member.user.id);

  let musics = [];

  for (const _user of users) {
    const user = await UserModel.findOne({ id: _user }).lean();

    if (user) {
      if (user.like) {
        for (const musicLike of user.like) {
          if (musicLike && musicLike.includes("youtube.com")) {
            if (!musics[musicLike]) {
              musics[musicLike] = { like: 0, dislike: 0, rating: 1 };
            }

            musics[musicLike].like = musics[musicLike].like + 1;
          }
        }
      }

      if (user.dislike) {
        for (const musicDislike of user.dislike) {
          if (!musics[musicDislike]) {
            musics[musicDislike] = { like: 0, dislike: 0, rating: 0 };
          }

          musics[musicDislike].dislike = musics[musicDislike].dislike + 1;

          musics[musicDislike].rating =
            musics[musicDislike].like /
            (musics[musicDislike].like + musics[musicDislike].dislike);
        }
      }
    }
  }

  room[voiceChannel.id]._musics = [];
  for (const id in musics) {
    if (musics[id].rating > 0.5) {
      const now = new Date();
      let music = await MusicModel.findOne({ id: id }).lean();

      if (!music) {
        music = await MusicModel.create({
          id: id,
          played: new Date(now.setFullYear(now.getFullYear() - 1))
        });
      }

      const lastPlayed = new Date(music.played);

      room[voiceChannel.id]._musics.push({
        ...musics[id],
        id: id,
        rating: musics[id].rating + (now.getTime() - lastPlayed.getTime())
      });
    }
  }

  room[voiceChannel.id]._musics = room[voiceChannel.id]._musics
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  await play(connection, voiceChannel);

  if (!room[voiceChannel.id]._musics) {
    client.user.setActivity("Waiting for fee");

    return;
  }

  room[voiceChannel.id].play = selectMusics(voiceChannel, connection);

  return;
};

const play = async (connection, voiceChannel) => {
  for (const music of room[voiceChannel.id]._musics) {
    if (!room[voiceChannel.id]._musics) {
      client.user.setActivity("Waiting for fee");

      return;
    }

    const videoStream = ytdl(music.id, {
      filter: "audioonly"
    });

    room[voiceChannel.id].pickup = connection.play(
      videoStream,
      room[voiceChannel.id].streamOptions
    );

    client.user.setActivity(music.id);

    try {
      let _music = await MusicModel.findOne({ id: music.id });
      if (!_music) {
        _music = await MusicModel.create({
          id: id,
          played: new Date()
        });
      } else {
        _music.played = new Date();
        _music.save();
      }
    } catch (error) {
      console.log("error", error);
    }

    await waitFinished(room[voiceChannel.id].pickup);
  }

  return;
};

const waitFinished = pickup => {
  return new Promise(resolve => {
    pickup.on("finish", () => {
      resolve();
    });
  });
};

const analysisMusics = async videos => {
  for (const video of videos) {
    try {
      const v = video.url.split("v=");

      const infos = await youtubeInfo(v[v.length - 1]);

      if (infos.duration < 9 * 60 && infos.genre === "Music") {
        if (!video.title) {
          video.title = infos.title;
        }
        return video;
      }
    } catch (error) {
      console.log("error analysisMusics", video.url, error);
    }
  }
};

client.login(config.token);
