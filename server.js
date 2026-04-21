require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

// --- FILE UPLOAD CONFIGURATION (MULTER) ---
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        // Ensure unique filenames
        cb(null, 'file-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

mongoose.connect('mongodb+srv://chennakesavarao89_db_user:Chenna12345@cluster0.ua8itq6.mongodb.net/?appName=Cluster0')
    .then(() => console.log('✅ Precifast ERP Database Connected Successfully!'))
    .catch(err => console.log('❌ Database Connection Error:', err));

// --- UPDATED SCHEMA ---
const taskSchema = new mongoose.Schema({
    dept: [String],
    date: Date,
    priority: String,
    targetDate: Date,
    resp: [String],
    email: String,
    mom: String,
    action: String,
    status: { type: String, default: 'OPEN' },
    // New fields for interaction
    acknowledged: { type: Boolean, default: false }, // Tracks if "OK" was clicked
    closingRemarks: String,                          // Text entered upon completion
    attachments: [String]                            // File paths
});

const Task = mongoose.model('Task', taskSchema);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

// --- API ENDPOINTS ---
app.post('/api/tasks', async (req, res) => {
    try {
        const newTask = new Task(req.body);
        await newTask.save();
        await sendEmailAlert(newTask);
        res.status(201).json({ message: "Task created." });
    } catch (error) {
        res.status(500).json({ error: "Error saving task" });
    }
});

app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.find().sort({ date: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ error: "Error fetching history" });
    }
});

// 1. Endpoint for clicking "OK" in email
app.get('/api/tasks/:id/acknowledge', async (req, res) => {
    try {
        await Task.findByIdAndUpdate(req.params.id, { acknowledged: true });
        res.send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #003366;">
                <h2>Task Acknowledged!</h2>
                <p>Status updated to: <b>Read, Replied OK</b>.</p>
                <p>You can close this window. The 3-hour triggers will continue until the task is completed.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send("Error acknowledging task.");
    }
});

// 2. Endpoint for completing task with files
app.post('/api/tasks/:id/complete', upload.array('files', 5), async (req, res) => {
    try {
        // Create an array of relative paths for the uploaded files
        const filePaths = req.files.map(file => '/uploads/' + file.filename);
        
        await Task.findByIdAndUpdate(req.params.id, {
            status: 'CLOSED',
            closingRemarks: req.body.remarks,
            attachments: filePaths
        });
        res.json({ message: "Task Closed Successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Error closing task." });
    }
});

// --- EMAIL SENDING LOGIC (WITH HTML BUTTONS) ---
async function sendEmailAlert(task) {
    const deptString = task.dept.join(', ');
    const respString = task.resp.join(', ');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: task.email,
        subject: `[${task.priority} Priority] Action Required - Dept: ${deptString}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #003366;">Automated Task Reminder</h2>
                <p>Hello <b>${respString}</b>,</p>
                <p>This is an automated reminder for an OPEN task in PRECIFAST PVT LTD</p>
                
                <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd; background: #F4F7F6;"><b>Department:</b></td><td style="padding: 8px; border: 1px solid #ddd;">${deptString}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; background: #F4F7F6;"><b>Target Date:</b></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date(task.targetDate).toLocaleDateString()}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; background: #F4F7F6;"><b>(MOM) Problem:</b></td><td style="padding: 8px; border: 1px solid #ddd;">${task.mom}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; background: #F4F7F6;"><b>Action Required:</b></td><td style="padding: 8px; border: 1px solid #ddd;">${task.action}</td></tr>
                </table>

                <p><b>Please respond to this task:</b></p>
                <a href="${baseUrl}/api/tasks/${task._id}/acknowledge" style="display: inline-block; padding: 12px 20px; margin-right: 15px; background-color: #FFCC00; color: #003366; text-decoration: none; font-weight: bold; border-radius: 4px;">Click to Acknowledge (OK)</a>
                
                <a href="${baseUrl}/complete.html?id=${task._id}" style="display: inline-block; padding: 12px 20px; background-color: #003366; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 4px;">Mark as Complete & Upload Files</a>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${task.email}`);
    } catch (error) {
        console.log("Error sending email:", error);
    }
}

cron.schedule('0 */3 * * *', async () => {
    try {
        // Only sends emails for OPEN tasks. Once CLOSED, it stops automatically.
        const openTasks = await Task.find({ status: 'OPEN' });
        for (let task of openTasks) {
            await sendEmailAlert(task);
        }
    } catch (error) {
        console.log("Error running cron:", error);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));