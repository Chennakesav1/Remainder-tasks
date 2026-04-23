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


const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        
        cb(null, 'file-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

mongoose.connect('mongodb+srv://chennakesavarao89_db_user:Chenna12345@cluster0.ua8itq6.mongodb.net/?appName=Cluster0')
    .then(() => console.log('✅ Precifast ERP Database Connected Successfully!'))
    .catch(err => console.log('❌ Database Connection Error:', err));


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
    acknowledged: { type: Boolean, default: false }, 
    closingRemarks: String,                          
    attachments: [String]                            
});

const Task = mongoose.model('Task', taskSchema);


const transporter = nodemailer.createTransport({
    host: 'mail.precifast.in',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    },
    tls: {
        
        rejectUnauthorized: false 
    }
});


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


app.post('/api/tasks/:id/complete', upload.array('files', 5), async (req, res) => {
    try {
        
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


async function sendEmailAlert(task) {
    const deptString = task.dept.join(', ');
    const respString = task.resp.join(', ');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const mailOptions = {
        from: '"PRECIFAST System" <' + process.env.EMAIL_USER + '>',
        to: task.email,
        subject: `[${task.priority}] Action Required - PRECIFAST Task: ${deptString}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div style="background-color: #003366; color: #ffffff; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">PRECIFAST PVT LTD</h1>
                    <p style="margin: 5px 0 0 0; font-size: 14px; color: #FFCC00;">Automated Task Reminder System</p>
                </div>
                
                <div style="padding: 30px; background-color: #ffffff; color: #333333;">
                    <p style="font-size: 16px;">Dear <b>${respString}</b>,</p>
                    <p style="font-size: 15px; line-height: 1.5;">This is an automated reminder regarding an <b>OPEN</b> task assigned to your department that requires your attention.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee; width: 35%; color: #666666;"><b>Priority:</b></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #d9534f; font-weight: bold;">${task.priority}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666;"><b>Department:</b></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee;">${deptString}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666;"><b>Target Date:</b></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee; font-weight: bold;">${new Date(task.targetDate).toLocaleDateString()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666;"><b>Problem (MOM):</b></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee;">${task.mom}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee; color: #666666;"><b>Action Required:</b></td>
                            <td style="padding: 12px; border-bottom: 1px solid #eeeeee;">${task.action}</td>
                        </tr>
                    </table>

                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${baseUrl}/api/tasks/${task._id}/acknowledge" style="display: inline-block; padding: 12px 24px; background-color: #FFCC00; color: #003366; text-decoration: none; font-weight: bold; border-radius: 5px; margin: 10px;">Acknowledge (OK)</a>
                        <a href="${baseUrl}/complete.html?id=${task._id}" style="display: inline-block; padding: 12px 24px; background-color: #003366; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 5px; margin: 10px;">Mark as Complete & Upload</a>
                    </div>
                </div>
                
                <div style="background-color: #f4f7f6; padding: 15px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #e0e0e0;">
                    <p style="margin: 0;">This is an automated system generated email. Please do not reply directly to this thread.</p>
                    <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} Precifast Pvt Ltd. All rights reserved.</p>
                </div>
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


app.put('/api/tasks/:id/remarks', async (req, res) => {
    try {
        await Task.findByIdAndUpdate(req.params.id, {
            closingRemarks: req.body.remarks
        });
        res.json({ message: "Remark updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error updating remark." });
    }
});

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