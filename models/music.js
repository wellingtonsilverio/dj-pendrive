const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const musicSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    played: { type: Date }
  },
  { collection: "music" }
);

const Music = mongoose.model("Music", musicSchema);

module.exports = Music;
