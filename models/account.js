const mongoose = require('mongoose');

const account = new mongoose.Schema({
    fullname: String,
    teamId: String,
    email: {
        type: String,
        require: true,
        unique: true,
    },
    password: String,
    accountLevel: String,
    avatar: String,
    dob: String,
    phone: String,
    gender: String,
    address: String,
    accessToken: String,
    expirationDateToken: Date,
    resetPasswordToken: String,
    expirationDateResetPasswordToken: String,
}, {
    timestamps: true,
});

module.exports = mongoose.model('account', account);