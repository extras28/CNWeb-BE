const Account = require("../models/account")
const { generateRandomStr, sha256 } = require("../utils")
const utils = require("../utils")
const moment = require("moment")
const sendEmail = require("../utils/nodeMailer")

const accountController = {
    signUp: async (req, res) => {
        try {
            //check Account existent
            let account = await Account.findOne({
                email: req.body.email,
            })

            if (account) {
                return res.send({
                    result: "failed",
                    message: "Tài khoản đã tồn tại",
                })
            }

            const hashed = await utils.sha256(req.body.password)

            const newAccount = new Account({
                fullname: req.body.fullname,
                email: req.body.email,
                password: hashed,
                accessToken: "",
                expirationDateToken: null,
                gender: "UNKNOWN",
                dob: null,
                avatar: "",
                address: "",
                phone: "",
            })

            await newAccount.save()

            return res.send({
                result: "success",
                account: newAccount,
            })
        } catch (err) {
            res.status(500).send({
                result: "failed",
                message: err,
            })
        }
    },
    signIn: async (req, res) => {
        try {
            const account = await Account.findOne({
                email: req.body.email,
            })

            if (!account) {
                return res.status(404).json({
                    result: "success",
                    message: "Email không đúng",
                })
            }

            const hashed = await utils.sha256(req.body.password)
            const validPassword = hashed === account.password

            if (!validPassword) {
                return res.status(404).json({
                    result: "failed",
                    message: "Sai mật khẩu",
                })
            }

            if (
                !account.accessToken ||
                moment(account.expirationDateToken).diff(moment.now()) < 0
            ) {
                var accessToken = generateRandomStr(32)
                var expirationDate = new Date()
                var time = expirationDate.getTime()
                var time1 = time + 24 * 3600 * 1000
                var setTime = expirationDate.setTime(time1)
                var expirationDateStr = moment(setTime)
                    .format("YYYY-MM-DD HH:mm:ss")
                    .toString()

                await account.updateOne({
                    accessToken: accessToken,
                    expirationDateToken: expirationDateStr,
                })
            }
            const responseAccount = await Account.findOne({
                _id: account._id,
            })

            return res.send({
                result: "success",
                account: responseAccount.toJSON(),
            })
        } catch (err) {
            res.status(500).json({
                result: "failed",
                error: err,
            })
        }
    },
    signOut: async (req, res) => {
        try {
            const accessToken = req.headers.authorization.split(" ")[1]
            const account = await Account.findOne({
                accessToken: accessToken,
            })
            await account.updateOne({
                accessToken: null,
                expirationDateToken: null,
            })

            const responseAccount = await Account.findOne({
                _id: account._id,
            })
            res.send({
                result: "success",
            })
        } catch (error) {
            res.status(500).send({
                result: "failed",
                reason: error.message,
            })
        }
    },
    requestToResetPassword: async (req, res) => {
        try {
            let { email } = req.body

            let account = await Account.findOne({
                email: email,
            })

            if (!account) {
                return res.send({
                    result: "failed",
                    message: "email không hợp lệ",
                })
            }
            var random = 100000 + Math.random() * 900000
            var plainResetPasswordToken = Math.floor(random)

            const hashedResetPasswordToken = await utils.sha256(
                plainResetPasswordToken.toString()
            )

            var expirationDate = new Date()
            var time = expirationDate.getTime()
            var time1 = time + 5 * 60 * 1000
            var setTime = expirationDate.setTime(time1)
            var expirationDateStr = moment(setTime)
                .format("YYYY-MM-DD HH:mm:ss")
                .toString()

            await Account.findOneAndUpdate(
                {
                    email: email,
                },
                {
                    resetPasswordToken: hashedResetPasswordToken,
                    expirationDateResetPasswordToken: expirationDateStr,
                }
            )

            res.send({
                result: "success",
                expirationDate: moment(expirationDate).toDate(),
            })

            await sendEmail(
                email,
                "CodeHelper your reset password code",
                plainResetPasswordToken
            )
        } catch (error) {
            res.send({
                result: "failed",
                message: error,
            })
        }
    },
    resetPassword: async (req, res) => {
        try {
            let { email, resetPasswordToken, newPassword } = req.body

            let account = await Account.findOne({
                email: email,
            })

            const hashedResetPasswordToken = utils.sha256(resetPasswordToken)

            const hashedPassword = utils.sha256(newPassword)

            if (!account) {
                return res.send({
                    result: "failed",
                    message: "Đổi mật khẩu không thành công",
                })
            }

            if (account.resetPasswordToken === hashedResetPasswordToken) {
                await Account.findOneAndUpdate(
                    {
                        email: email,
                    },
                    {
                        resetPasswordToken: null,
                        expirationDateResetPasswordToken: null,
                        password: hashedPassword,
                    }
                )
                return res.send({
                    result: "success",
                    message: "Thay đổi mật khẩu thành công",
                })
            }
        } catch (error) {
            res.send({
                result: "failed",
                message: error,
            })
        }
    },
    changePassword: async (req, res) => {
        try {
            const accessToken = req.headers.authorization.split(" ")[1]
            const account = await Account.findOne({
                accessToken: accessToken,
            })
            const password = await sha256(req.body.password)
            const newPassword = await sha256(req.body.newPassword)

            if (account) {
                if (password === account.password) {
                    await Account.findByIdAndUpdate(account.id, {
                        password: newPassword,
                    })
                    return res.send({
                        result: "success",
                        message: "Đổi mật khẩu thành công",
                    })
                }
                return res.send({
                    result: "failed",
                    message: "Mật khẩu cũ không chính xác",
                })
            }
            return res.send({
                result: "faled",
                message: "Sai email",
            })
        } catch (err) {
            res.send({
                result: "faled",
                message: err,
            })
        }
    },

    find: async (req, res) => {
        let { q, page, limit } = req.query;
        q = q ?? "";
        try {
            Account
                .find({
                    fullname: { $regex: `.*${q}.*`, $options: "i" },
                })
                .skip(limit * page - limit)
                .limit(limit)
                .exec((err, accounts) => {
                    Account.countDocuments((err, count) => {
                        if (err) {
                            return res.send({
                                result: "failed",
                                message: err,
                            })
                        } else {
                            return res.send({
                                result: "success",
                                page: page,
                                limit: limit,
                                total: count,
                                accounts: accounts,
                            })
                        }
                    })
                })
        } catch (error) {}
    },
}

module.exports = accountController
