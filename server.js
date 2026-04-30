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
app.get('/favicon.ico', (req, res) => res.status(204).end());

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

// --- 1. SCHEMA UPDATED ---
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
    acknowledged: { type: Boolean, default: false }, 
    acknowledgeRemarks: String,
    closingRemarks: String,                          
    attachments: [String],
    triggerCount: { type: Number, default: 0 },
    lastEmailedAt: { type: Date, default: Date.now } // NEW: Tracks the exact time of the last email
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
        // 1. Save the new task
        const newTask = new Task(req.body);
        newTask.lastEmailedAt = new Date();
        await newTask.save();

        // 2. Extract emails
        const emails = newTask.email.split(',').map(e => e.trim()).filter(e => e);

        // 3. Process and send emails
        for (let userEmail of emails) {
            const userOpenTasks = await Task.find({ 
                status: 'OPEN',
                email: { $regex: new RegExp(userEmail, 'i') } 
            });

            if (userOpenTasks.length > 0) {
                // REMOVED 'await' HERE! 
                // Now it sends in the background and doesn't freeze the website.
                sendConsolidatedEmail(userEmail, userOpenTasks);
                
                // Update the timers
                for (let task of userOpenTasks) {
                    await Task.findByIdAndUpdate(task._id, { lastEmailedAt: new Date() });
                }
            }
        }

        // Instantly reply to the website so it changes to "Success!"
        res.status(201).json({ message: "Task created and consolidated emails sent." });
    } catch (error) {
        console.error("Task Creation Error:", error);
        res.status(500).json({ error: "Error saving task to database." });
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

app.post('/api/tasks/:id/acknowledge', async (req, res) => {
    try {
        await Task.findByIdAndUpdate(req.params.id, { 
            acknowledged: true,
            acknowledgeRemarks: req.body.remarks // Saves the text they entered
        });
        res.json({ message: "Task Acknowledged Successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Error acknowledging task." });
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


// --- 2. NEW INDIVIDUAL 3-HOUR TRIGGER LOGIC ---
// Runs every minute to check if exactly 3 hours have passed for specific tasks
cron.schedule('* * * * *', async () => {
    try {
        // Calculate the time exactly 3 hours ago
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); 

        // Find tasks that are OPEN AND haven't been emailed in over 3 hours
        const dueTasks = await Task.find({ 
            status: 'OPEN',
            lastEmailedAt: { $lte: threeHoursAgo }
        });

        if (dueTasks.length === 0) return; // Nothing due right now

        // Group the due tasks by individual email address
        const tasksByEmail = {};
        dueTasks.forEach(task => {
            if (task.email) {
                const emails = task.email.split(',').map(e => e.trim());
                emails.forEach(email => {
                    if (email) {
                        if (!tasksByEmail[email]) tasksByEmail[email] = [];
                        tasksByEmail[email].push(task);
                    }
                });
            }
        });

        // Send one summary email per person
        for (let [email, tasks] of Object.entries(tasksByEmail)) {
            await sendConsolidatedEmail(email, tasks);

            // --- 3. RESET TIMER ---
            // After sending, update lastEmailedAt and triggerCount so the 3-hour wait starts again
            for (let task of tasks) {
                await Task.findByIdAndUpdate(task._id, { 
                    lastEmailedAt: new Date(),
                    $inc: { triggerCount: 1 } 
                });
            }
        }

    } catch (error) {
        console.log("Error running cron:", error);
    }
});


async function sendConsolidatedEmail(userEmail, userTasks) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    let tableRows = '';
    userTasks.forEach((task, index) => {
        tableRows += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                <td style="padding: 10px; border: 1px solid #ddd; color: #d9534f; font-weight: bold;">${task.priority}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${(task.dept || []).join(', ')}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${task.mom}</td>
                <td style="padding: 10px; border: 1px solid #ddd; color: #003366; font-weight: bold;">${task.action}</td> 
                <td style="padding: 10px; border: 1px solid #ddd;">${new Date(task.targetDate).toLocaleDateString()}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                    <a href="${baseUrl}/acknowledge.html?id=${task._id}" style="color: #003366; font-weight:bold; text-decoration: underline; display:block; margin-bottom: 8px;">Acknowledge</a>
                    <a href="${baseUrl}/complete.html?id=${task._id}" style="display: inline-block; padding: 6px 10px; background-color: #003366; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 12px;">Close Task</a>
                </td>
            </tr>
        `;
    });

    const mailOptions = {
        from: '"PRECIFAST System" <' + process.env.EMAIL_USER + '>',
        to: userEmail,
        subject: `[Reminder] You have ${userTasks.length} OPEN Task(s) Pending`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 900px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #003366; color: #ffffff; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">PRECIFAST PVT LTD</h1>
                    <p style="margin: 5px 0 0 0; color: #FFCC00;">Consolidated Task Reminder</p>
                </div>
                
                <div style="padding: 20px; color: #333333;">
                    <p>Hello,</p>
                    <p>You currently have <b>${userTasks.length} OPEN task(s)</b> that require your attention. Please review them below and close them out once completed.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
                        <thead>
                            <tr style="background-color: #f4f7f6; color: #003366;">
                                <th style="padding: 10px; border: 1px solid #ddd;">#</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Priority</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Dept</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Problem (MOM)</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Action Required</th> 
                                <th style="padding: 10px; border: 1px solid #ddd;">Target Date</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Links</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Consolidated email sent to ${userEmail} with ${userTasks.length} tasks.`);
    } catch (error) {
        console.log("Error sending consolidated email:", error);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));