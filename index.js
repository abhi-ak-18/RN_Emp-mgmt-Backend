const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const moment = require("moment");

const app = express();
const port = 8000;
const cors = require("cors");
app.use(cors());

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongoose
  .connect("mongodb+srv://jodduser:jodduser123@cluster0.ps9vb0j.mongodb.net/", {
    useNewURLParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB...");
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB", error);
  });

app.listen(port, () => {
  console.log("Server running on port 8000");
});

const Employee = require("./models/employee");
const Attendance = require("./models/attendance");

//endpoint to register an employee
app.post("/addEmployee", async (req, res) => {
  try {
    const {
      employeeName,
      employeeId,
      designation,
      phoneNumber,
      dateOfBirth,
      joiningDate,
      activeEmployee,
      salary,
      address,
      department,
    } = req.body;

    //create a new employee
    const newEmployee = new Employee({
      employeeName,
      employeeId,
      designation,
      phoneNumber,
      dateOfBirth,
      joiningDate,
      activeEmployee,
      salary,
      address,
      department,
    });

    //save the employee to db
    await newEmployee.save();
    res
      .status(201)
      .json({ message: "Employee saved successfully", employee: newEmployee });
  } catch (error) {
    console.log("Error creating employee", error);
    res.status(500).json({ message: "Failed to add an employee" });
  }
});

//endpoint to get all employees
app.get("/employees", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    if (!employees || !employees.length > 0) {
      return res.status(404).send({ message: "No Employees Found!" });
    } else {
      return res.status(200).json(employees);
    }
  } catch (err) {
    console.log("Error getting employees", err);
    res.status(500).json({ message: "Failed to fetch employees" });
  }
});

//mark attendance
app.post("/attendance", async (req, res) => {
  try {
    const { employeeId, employeeName, date, status } = req.body;

    const existingAttendance = await Attendance.findOne({ employeeId, date });

    if (existingAttendance) {
      existingAttendance.status = status;
      await existingAttendance.save();
      res.status(200).json(existingAttendance);
    } else {
      const newAttendance = new Attendance({
        employeeId,
        employeeName,
        date,
        status,
      });
      await newAttendance.save();
      res.status(200).json(newAttendance);
    }
  } catch (error) {
    console.log("Error submitting attendance api", error);
    res.status(500).json({ message: "Failed to submit attendance" });
  }
});

//fetch attendance
app.get("/attendance", async (req, res) => {
  try {
    const { date } = req.query;

    const attendanceData = await Attendance.find({ date: date });
    res.status(200).json(attendanceData);
  } catch (error) {
    console.log("Error fetching attendance", error);
    res.status(500).json({ message: "Failed fetching attendance" });
  }
});

//fetch the summary report
app.get("/summaryReport", async (req, res) => {
    try {
      const { month, year } = req.query;
      console.log("query parameters:", month, year);
  
      const startDate = moment(`${year}-${month}-01`, "YYYY-MM-DD")
        .startOf("month")
        .toDate();
      const endDate = moment(startDate).endOf("month").toDate();
  
      const report = await Attendance.aggregate([
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [
                    {
                      $month: { $dateFromString: { dateString: "$date" } },
                    },
                    parseInt(req.query.month),
                  ],
                },
                {
                  $eq: [
                    {
                      $year: { $dateFromString: { dateString: "$date" } },
                    },
                    parseInt(req.query.year),
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$employeeId",
            present: {
              $sum: {
                $cond: {
                  if: { $eq: ["$status", "present"] },
                  then: 1,
                  else: 0,
                },
              },
            },
            absent: {
              $sum: {
                $cond: {
                  if: { $eq: ["$status", "absent"] },
                  then: 1,
                  else: 0,
                },
              },
            },
            halfday: {
              $sum: {
                $cond: {
                  if: { $eq: ["$status", "halfday"] },
                  then: 1,
                  else: 0,
                },
              },
            },
            holiday: {
              $sum: {
                $cond: {
                  if: { $eq: ["$status", "holiday"] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "employees",
            localField: "_id",
            foreignField: "employeeId",
            as: "employeeDetails",
          },
        },
        {
          $unwind: "$employeeDetails",
        },
        {
          $project: {
            _id: 1,
            present: 1,
            absent: 1,
            halfday: 1,
            name: "$employeeDetails.employeeName",
            designation: "$employeeDetails.designation",
            salary: "$employeeDetails.salary",
            employeeId: "$employeeDetails.employeeId",
          },
        },
      ]);
  
      res.status(200).json({ report });
    } catch (error) {
      console.log("Error fetching attendance summary report", error);
      res
        .status(500)
        .json({ message: "Failed fetching attendance summary report" });
    }
  });
  
