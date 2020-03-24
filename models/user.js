const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    like: [String],
    dislike: [String]
  },
  { collection: "user" }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
