const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const mongoose = require("mongoose");
const yts = require("yt-search");

const client = new Discord.Client();
const config = require("./config.json");
mongoose.set("useCreateIndex", true);

const UserModel = require("./models/user");

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
  //   client.user.setPresence({
  //     game: {
  //       name: "comando",
  //       type: 1,
  //       url: "https://www.twitch.tv/pedroricardo"
  //     }
  //   });
  //0 = Jogando
  //  1 = Transmitindo
  //  2 = Ouvindo
  //  3 = Assistindo
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
    const sendId = message.author.id;
    // const voiceChannel = message.member.voice.channel;

    let user = await UserModel.findOne({ id: sendId });

    if (!user) {
      user = await UserModel.create({
        id: sendId
      });
    }

    if (!user.like) {
      user.like = [];
    }

    const search = await yts(music);
    if (search.videos.length < 1) {
      message.channel.send(
        "Oh no, it looks like I didn't find this song in my music folder."
      );

      return;
    }

    const video = search.videos[0];

    if (!user.like[video.url]) {
      user.like.push(video.url);

      await user.save();
    }

    message.channel.send(`I'll try to play ${video.title} for you.`);

    return;
  }

  if (command === "skip") {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      await message.channel.send("Hold on, I'm not playing!");

      return;
    }

    const connection = await voiceChannel.join();

    connection.dispatcher.end();

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

    const video = client.presence.activities.name;

    if (!video.includes("youtube.com")) {
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

  if (command === "play") {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      await message.channel.send(
        "I have no place to play :(, tell me a channel to go."
      );
      message.channel.send(
        "Help: send in text channel @dj channel 'voice channel id'"
      );

      return;
    }

    const connection = await voiceChannel.join();

    const users = voiceChannel.members
      .filter(member => !member.user.bot)
      .map(member => member.user.id);

    let musics = [];

    for (const _user of users) {
      const user = await UserModel.findOne({ id: _user }).lean();

      for (const musicLike of user.like) {
        if (!musics[musicLike]) {
          musics[musicLike] = { like: 0, dislike: 0, rating: 0 };
        }

        musics[musicLike].like = musics[musicLike].like + 1;
        musics[musicLike].rating =
          musics[musicLike].like / musics[musicLike].like +
          musics[musicLike].dislike;
      }
    }

    play(
      connection,
      musics.sort((a, b) => b.rating - a.rating)
    );

    return;
  }
});

const play = async (connection, musics) => {
  for (const music in musics) {
    const videoStream = ytdl(music, {
      filter: "audioonly"
    });

    const pickup = connection.play(videoStream, config.streamOptions);

    client.user.setActivity(music);

    await waitFinished(pickup);
  }

  client.user.setActivity("Waiting for fee");

  return;
};

const waitFinished = pickup => {
  return new Promise(resolve => {
    pickup.on("finish", () => {
      resolve();
    });
  });
};

client.login(config.token);
