import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });
const app = express();
const port = 5001;
const db = new pg.Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
});
db.connect();

const monthList = [
  0,
  "January",
  "Febuary",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const options = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

function formatDate(date) {
  return date.toLocaleString("en-gb", options);
}

async function getCategory() {
  let category = [];
  const cat_result = await db.query("SELECT cat_name from category");
  cat_result.rows.forEach((item) => {
    category.push(item.cat_name);
  });
  return category;
}

async function getTotalByMonth(month) {
  let monthlyTotal = 0;
  const result = await db.query(
    "select sum(amount) as total from transaction where extract(month from transc_date) = $1",
    [month]
  );
  result.rows.forEach((item) => {
    monthlyTotal = item.total;
  });
  return monthlyTotal;
}

async function getHistory() {
  const history = [];
  const result = await db.query(
    "select * from transaction order by transc_date desc"
  );

  result.rows.forEach((item) => {
    history.push({
      name: item.transc_name,
      desc: item.transc_desc,
      amount: parseInt(item.amount).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
      }),
      category: item.category,
      type: item.transc_type,
      date: formatDate(item.transc_date),
    });
  });
  return history;
}

async function getExpensesData() {
  const expenses = [];
  const result = await db.query("select * from transaction");
  result.rows.forEach((item) => {
    expenses.push({
      name: item.transc_name,
      desc: item.transc_desc,
      amount: item.amount,
      category: item.category,
      type: item.transc_type,
      date: formatDate(item.transc_date),
    });
  });
  return expenses;
}

async function getExpensesDataByMonth(month) {
  const expenses = [];
  const result = await db.query(
    "select * from transaction where extract(month from transc_date) = $1",
    [month]
  );
  result.rows.forEach((item) => {
    expenses.push({
      name: item.transc_name,
      desc: item.transc_desc,
      amount: item.amount,
      category: item.category,
      type: item.transc_type,
      date: formatDate(item.transc_date),
    });
  });
  return expenses;
}

async function getExpenseBalance() {
  let expense_balance = 0;
  const expense_result = await db.query(
    "select sum(amount) from transaction where transc_type = 'Expense'"
  );
  expense_result.rows.forEach((item) => {
    expense_balance = parseInt(item.sum);
  });
  return expense_balance;
}

async function getIncomeBalance() {
  let income_balance = 0;
  const income_result = await db.query(
    "select sum(amount) from transaction where transc_type = 'Income'"
  );
  income_result.rows.forEach((item) => {
    income_balance = parseInt(item.sum);
  });
  return income_balance;
}

async function getExpenseBalanceByMonth(month) {
  let expense_balance = 0;
  const expense_result = await db.query(
    "select sum(amount) from transaction where transc_type = 'Expense' and extract(month from transc_date) = $1",
    [month]
  );
  expense_result.rows.forEach((item) => {
    expense_balance = parseInt(item.sum);
  });
  if (expense_balance) {
    return expense_balance;
  } else {
    return 0;
  }
}

async function getIncomeBalanceMonth(month) {
  let income_balance = 0;
  const income_result = await db.query(
    "select sum(amount) from transaction where transc_type = 'Income' and extract(month from transc_date) = $1",
    [month]
  );
  income_result.rows.forEach((item) => {
    income_balance = parseInt(item.sum);
  });
  if (income_balance) {
    return income_balance;
  } else {
    return 0;
  }
}

app.get("/", async (req, res) => {
  const expensesData = await getExpensesData();
  const expenseBalance = await getExpenseBalance();
  const incomeBalance = await getIncomeBalance();
  res.render("index.ejs", {
    transaction: expensesData,
    balance: parseInt(incomeBalance - expenseBalance).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
    }),
    income: incomeBalance.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
    }),
    expense: expenseBalance.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
    }),
    monthly: parseInt(incomeBalance - expenseBalance).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
    }),
    monthString: "All Transaction",
  });
});

app.post("/transaction", async (req, res) => {
  const category = await getCategory();
  res.render("transaction.ejs", { type: "Expense", category: category });
});

app.post("/direct", async (req, res) => {
  let transc_type = req.body.transc_type;
  const category = await getCategory();
  if (transc_type === "Income") {
    transc_type = "Income";
  }
  res.render("transaction.ejs", { type: transc_type, category: category });
});

app.post("/add", async (req, res) => {
  const name = req.body.name;
  const desc = req.body.desc;
  const category = req.body.category;
  const amount = req.body.amount;
  const type = req.body.transc_type;
  const date = req.body.date;
  if (type === "Category") {
    await db.query("INSERT INTO category (cat_name) values ($1)", [name]);
  } else {
    try {
      await db.query(
        "INSERT INTO TRANSACTION (transc_name, trans_desc, category, amount,transc_type, transc_date) values($1,$2,$3, $4, $5, $6)",
        [name, desc, category, amount, type, date]
      );
    } catch (error) {
      console.error(error);
    }
  }

  res.redirect("/");
});

app.post("/filter", async (req, res) => {
  const monthIndex = parseInt(req.body.monthIndex);
  const dataByMonth = await getTotalByMonth(monthIndex);
  const expensesData = await getExpensesDataByMonth(monthIndex);
  const expenseBalance = await getExpenseBalanceByMonth(monthIndex);
  const incomeBalance = await getIncomeBalanceMonth(monthIndex);
  if (monthIndex >= 1 || monthIndex <= 12) {
    if (dataByMonth) {
      res.render("index.ejs", {
        transaction: expensesData,
        balance: parseInt(incomeBalance - expenseBalance).toLocaleString(
          "id-ID",
          {
            style: "currency",
            currency: "IDR",
          }
        ),
        income: incomeBalance.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        }),
        expense: expenseBalance.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        }),
        monthly: parseInt(incomeBalance - expenseBalance).toLocaleString(
          "id-ID",
          {
            style: "currency",
            currency: "IDR",
          }
        ),
        monthString: monthList[monthIndex],
      });
    } else {
      res.render("index.ejs", {
        transaction: expensesData,
        balance: parseInt(incomeBalance - expenseBalance).toLocaleString(
          "id-ID",
          {
            style: "currency",
            currency: "IDR",
          }
        ),
        income: incomeBalance.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        }),
        expense: expenseBalance.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        }),
        monthly: 0,
        monthString: monthList[monthIndex],
      });
    }
  } else {
    res.redirect("/");
  }
});

app.get("/history", async (req, res) => {
  const listHistory = await getHistory();
  res.render("history.ejs", { transaction: listHistory });
});

app.listen(port);
