const express = require("express");
const passport = require("passport");
const session = require("express-session");
const pool = require("./db");
const path = require("path");
const fs = require("fs");
const files = fs.readdirSync(__dirname + "/files");
const SomeRandomCat = require("some-random-cat").Random;
const url = "https://www.anekdot.ru/random/anekdot/";
const searchClass = /<div class="text">(?:(?!<\/div).)*<\/div>/gs;
const bcrypt = require("bcrypt");
const saltRounds = 10;

// Создаем экземпляр Express.js приложения
const app = express();

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Инициализируем Passport.js
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

require("./passport");

// Middleware для проверки аутентификации для папки static
app.use("/", (req, res, next) => {
  if (!req.isAuthenticated() && files.includes(req.url.slice(1))) {
    res.redirect("/login");
  } else {
    next();
  }
});

app.use("/", express.static(path.join(__dirname, "files")));

async function check(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// Главная страница
app.get("/", check, (req, res) => {
  let nav = "";
  files.forEach((element) => {
    nav += `<a href="/${element}">${element}</a><br />`;
  });

  res.send(`<!DOCTYPE html>
  <html lang="ru">
    <head>
      <meta charset="UTF-8" />
      <title>Главная страница</title>
    </head>
    <body>
      <h1>Добро пожаловать на наш сайт!</h1>
      <p>Создано с использованием Node.js, Express и Гоши.</p>
      <nav>
        ${nav}
        <a href="/jokes">jokes</a><br />
        <a href="/cat">cat</a><br />
        <a href="logout">LogOut</a><br />
        <a href="change_password">Изменить пароль</a>
      </nav>
    </body>
  </html>`);
});

// Страница входа
app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/");
  } else {
    res.sendFile(__dirname + "/vies/login.html");
  }
});

// Выход
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

// Страница регистрации
app.get("/registration", (req, res) => {
  res.sendFile(__dirname + "/vies/registration.html");
});

// Страница изменения пароля
app.get("/change_password", check, (req, res) => {
  res.sendFile(__dirname + "/vies/change_password.html");
});

// Анегдоты
app.get("/jokes", check, async (req, res) => {
  const response = await fetch(url);
  const data = await response.text();

  //Поиск анекдотов
  const allJoces = data.match(searchClass);
  let jocesHtml = "";
  for (let i = 0; i < 5 && i < allJoces.length - 1; i++) {
    jocesHtml += `<h3>Анекдот № ${i + 1}: </h3>${allJoces[i]}`;
  }

  res.send(jocesHtml);
});

// Котики
app.get("/cat", check, async (req, res) => {
  SomeRandomCat.getCat()
    .then((cat) => {
      res.send(`<img src=${cat.url} ></img>`);
    })
    .catch((e) => {
      console.error(e);
    });
});

// Вход
app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
  }),
  (req, res) => {
    res.redirect("/");
  }
);

// Регистрация
app.post("/registration", (req, result) => {
  const login = req.body.username;
  // Хеширование пароля
  bcrypt.hash(req.body.password1, saltRounds, function (err1, hash) {
    if (err1) {
      // Обработка ошибки
      result.send("Err hash");
    } else {
      // Сохранение хэша в базу данных
      pool.query(
        "SELECT * FROM users WHERE login = $1::text",
        [login],
        (err, res) => {
          console.log(res.rows[0]);
          if (err) {
            result.send("Err");
          }
          if (res.rowCount > 0) {
            result.send("Этот логин занят");
          } else {
            pool.query("insert into users(login, password) values ($1, $2);", [
              login,
              hash,
            ]);
            result.redirect("/");
          }
        }
      );
    }
  });
});

// Изменение пароля
app.post("/change_password", (req, post_res) => {
  const userid = req.user;
  pool.query("SELECT * FROM users WHERE id = $1", [userid], (err, res) => {
    if (err) {
      return done(err);
    }
    if (res.rowCount === 0) {
      return done(null, false);
    }
    const hash = res.rows[0].password;
    bcrypt.compare(req.body.old_password, hash, function (err1, comp_res) {
      if (comp_res) {
        // Пароль верный
        bcrypt.hash(req.body.new_password1, saltRounds, function (err2, hash2) {
          if (err2) {
            // Обработка ошибки
            result.send("Err hash");
          } else {
            // Изменение хэша пароля в базе данных
            pool.query("update users set password = $1 where id = $2;", [
              hash2,
              userid,
            ]);
            post_res.redirect("/");
          }
        });
      } else {
        // Старый пароль неверный
        post_res.send("Неверный старый пароль");
      }
    });
  });
});

app.get("*", (req, res) => {
  res.status(404).send("404 Page Not Found (Custom)");
});

// Запускаем сервер
const PORT = 3000;
(async () => {
  try {
    await pool.connect();

    await pool.query(
      "create TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, login VARCHAR(255), password VARCHAR(255));"
    );
    console.log("Table created or already exists");

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.log(error);
    console.log("Ошибка: " + error);
  }
})();
