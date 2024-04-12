const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const pool = require("./db");
const bcrypt = require("bcrypt");

// Используем LocalStrategy для аутентификации
passport.use(
  new LocalStrategy(
    {
      usernameField: "username", // Поле, которое будет использоваться для имени пользователя
      passwordField: "password", // Поле, которое будет использоваться для пароля
    },
    (username, password, done) => {
      // Логика проверки учетных данных в базе данных
      pool.query(
        "SELECT * FROM users WHERE login = $1::text",
        [username],
        (err, res) => {
          if (err) {
            return done(err);
          }
          if (res.rowCount === 0) {
            return done(null, false);
          }
          const hash = res.rows[0].password;
          bcrypt.compare(password, hash, function (err, result) {
            if (result) {
              // Пароль верный
              return done(null, res.rows[0]);
            } else {
              // Пароль неверный
              console.log("Неверный пароль");
              return done(null, false);
            }
          });
        }
      );
    }
  )
);

passport.serializeUser(function (user, done) {
  return done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  return done(null, id);
});

module.exports = passport;
