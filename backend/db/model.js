import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    // Stored separately so we can do exact, case-insensitive lookups
    // without using a user-controlled RegExp (which was a ReDoS / injection risk).
    usernameLower: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // bcrypt hash, never plaintext
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
