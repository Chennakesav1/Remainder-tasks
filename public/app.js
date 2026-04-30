function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    const tablinks = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";

    // ✅ FIX: Now it fetches the latest database info for BOTH Open and Closed tabs
    if (tabName === 'historyTab' || tabName === 'closedTab') {
        loadHistory();
    } 
    
    // ✅ FIX: Ensures Analytics load properly when clicked
    if (tabName === 'analyticsTab') {
        renderAnalytics();
    }
}


const emailMapping = {
    "DILLI": "dilli.d@precifast.in",
    "UMA MAHESH": "maintenance@precifast.in",
    "RAJESH": "e.rajesh@precifast.in",
    "MANOHAR": "prod@precifast.in",
    "TRIPATHI": "lstripathi@precifast.in", 
    "QA-BALA": "sqa@precifast.in", 
    "BALA": "balakrishna.b@precifast.in",
    "DESIGN/NPD": "parandama@precifast.in" ,
    "HR":"hr.ppl@precifast.in",
    "VIKAS": "vikas.s@precifast.in",
    "PPC":"ppc@precifast.in",
    "NANI": "narasimha.nath@precifast.in",
    

};


document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    
    
    loadHistory(); 
});

function getSelectedValues(selectId) {
    const select = document.getElementById(selectId);
    return Array.from(select.selectedOptions).map(option => option.value);
}


document.getElementById('resp').addEventListener('change', function() {
    const selectedPersons = getSelectedValues('resp');
    
    const emails = selectedPersons
        .map(person => emailMapping[person])
        .filter(email => email !== undefined);
    
    document.getElementById('email').value = emails.join(', ');
});


function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toISOString().split('T')[0];
}

// Global variable to hold tasks for searching/filtering
let globalTasks = [];

async function loadHistory() {
    try {
        const response = await fetch('/api/tasks');
        globalTasks = await response.json();
        renderTable(globalTasks);
    } catch (error) {
        console.error("Error loading history:", error);
    }
}


function renderTable(tasksToRender) {
    const openBody = document.getElementById('openBody');
    const closedBody = document.getElementById('closedBody');
    
    // Clear both tables
    if (openBody) openBody.innerHTML = ''; 
    if (closedBody) closedBody.innerHTML = ''; 

    let openIndex = 1;
    let closedIndex = 1;

    tasksToRender.forEach((task) => {
        const row = document.createElement('tr');
        const priorityColor = task.priority === 'HIGH' ? '#d9534f' : (task.priority === 'MEDIUM' ? '#f0ad4e' : '#5bc0de');
        
        // Attachment Links 
        let attachmentLinks = '';
        if (task.attachments && task.attachments.length > 0) {
            attachmentLinks = task.attachments.map((filePath, i) => 
                `<a href="${filePath}" target="_blank" style="color:var(--primary-blue); font-weight:bold; display:block; margin-top:5px;">View File ${i+1}</a>`
            ).join('');
        }

        const currentSerialNo = task.status === 'OPEN' ? openIndex++ : closedIndex++;

        // --- NEW LOGIC: Calculate the Reply Text for the new column ---
        let replyText = "";
        if (task.acknowledgeRemarks) {
            replyText += `<span style="color: #d9534f; font-size: 12px; display:block; margin-bottom:4px;"><b>Ack Reply:</b> ${task.acknowledgeRemarks}</span>`;
        }
        if (task.status === 'CLOSED' && task.closingRemarks) {
            replyText += `<span style="color: #003366; font-size: 12px; display:block;"><b>Close Reply:</b> ${task.closingRemarks}</span>`;
        }
        // -------------------------------------------------------------

        row.innerHTML = `
            <td style="text-align:center;">${currentSerialNo}</td>
            <td style="white-space:nowrap;">${formatDate(task.date)}</td>
            <td style="text-align:center; font-weight:bold; color:var(--primary-blue);">${task.triggerCount || 0}</td>
            <td style="font-weight:bold; color:${priorityColor};">${task.priority || ''}</td>
            <td>${(task.dept || []).join(', ')}</td>
            <td style="max-width:200px;">${task.mom || ''}</td>
            <td style="max-width:200px;">${task.action || ''}</td>
            <td>${(task.resp || []).join(', ')}</td>
            <td style="white-space:nowrap; font-weight:bold;">${formatDate(task.targetDate)}</td>
            
            <td>
                <span class="status-${task.status.toLowerCase()}">${task.status}</span>
                ${task.acknowledged && task.status === 'OPEN' ? '<br><small style="color:green;">✓ Ack</small>' : ''}
            </td>
            
            <td style="max-width:200px; background-color: #f8f9fa;">
                ${replyText || '<i style="color:#999; font-size:12px;">No replies yet</i>'}
            </td>

            <td>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <textarea id="remark-input-${task._id}" rows="2" style="width: 140px; font-size: 0.8rem; border-radius:3px; border:1px solid #ccc;">${task.closingRemarks || ''}</textarea>
                    <button onclick="window.saveRemark(event, '${task._id}')" class="save-remark-btn" style="padding:4px; font-size:0.75rem;">Save</button>
                    ${attachmentLinks}
                </div>
            </td>
        `;
        
        // Push the row to the correct table body based on status
        if (task.status === 'OPEN') {
            if (openBody) openBody.appendChild(row);
        } else {
            if (closedBody) closedBody.appendChild(row);
        }
    });
}
// Updated Multi-Filter to include the re-added columns
function filterTable() {
    const start = document.getElementById('filterStartDate').value;
    const end = document.getElementById('filterEndDate').value;
    const priority = document.getElementById('filterPriority').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    const filtered = globalTasks.filter(task => {
        const taskDate = task.date ? task.date.split('T')[0] : "";
        const matchesDate = (!start || taskDate >= start) && (!end || taskDate <= end);
        const matchesPriority = priority === 'ALL' || task.priority === priority;
        
        // Searching across multiple fields
        const matchesSearch = 
            (task.resp || []).join(' ').toLowerCase().includes(search) || 
            (task.dept || []).join(' ').toLowerCase().includes(search) ||
            
            (task.action || '').toLowerCase().includes(search) ||
            (task.mom || '').toLowerCase().includes(search);

        return matchesDate && matchesPriority && matchesSearch;
    });

    renderTable(filtered);
}

document.getElementById('taskForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const taskData = {
        dept: getSelectedValues('dept'),       
        priority: document.getElementById('priority').value,
        date: document.getElementById('date').value,
        targetDate: document.getElementById('targetDate').value,
        resp: getSelectedValues('resp'),       
        email: document.getElementById('email').value, 
        mom: document.getElementById('mom').value,
        action: document.getElementById('action').value
    };

    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = "Sending...";
    statusDiv.style.color = "#003366";

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });

        // Read the raw response first (safeguard against crashes)
        const textResult = await response.text();

        if (response.ok) {
            statusDiv.textContent = "Task recorded! Emails triggering in the background.";
            statusDiv.style.color = "#28a745"; 
            
            document.getElementById('taskForm').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            
            loadHistory(); 
        } else {
            // Try to show the exact error message
            try {
                const jsonError = JSON.parse(textResult);
                statusDiv.textContent = "Error: " + (jsonError.error || "Unknown error");
            } catch {
                statusDiv.textContent = "Server Error: " + textResult;
            }
            statusDiv.style.color = "#dc3545"; 
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        statusDiv.textContent = "Failed to connect to the server. Is it running?";
        statusDiv.style.color = "#dc3545";
    }
});

async function editRemark(taskId) {
    const currentRemarkSpan = document.getElementById(`remark-text-${taskId}`);
    const currentText = currentRemarkSpan.innerText;
    
    
    const newRemark = prompt("Edit Closing Remark for PRECIFAST:", currentText === 'N/A' ? '' : currentText);
    
    
    if (newRemark !== null && newRemark.trim() !== "") {
        try {
            const response = await fetch(`/api/tasks/${taskId}/remarks`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ remarks: newRemark })
            });
            
            if (response.ok) {
                
                loadHistory(); 
            } else {
                alert("Failed to update remark.");
            }
        } catch (error) {
            console.error("Error updating remark:", error);
            alert("Network error.");
        }
    }
}
// --- NEW LOGIC: INLINE SAVE REMARK (Attached to Window) ---
window.saveRemark = async function(event, taskId) {
    const btn = event.target;
    const remarkText = document.getElementById(`remark-input-${taskId}`).value;
    
    // Change button appearance to show it's working
    btn.textContent = "Saving...";
    btn.style.opacity = "0.7";

    try {
        const response = await fetch(`/api/tasks/${taskId}/remarks`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remarks: remarkText })
        });
        
        if (response.ok) {
            btn.textContent = "Saved ✓";
            btn.style.backgroundColor = "#28a745"; // Green color
            btn.style.color = "white";
            btn.style.opacity = "1";
            
            setTimeout(() => {
                btn.textContent = "Save";
                btn.style.backgroundColor = "";
                btn.style.color = "";
            }, 2000);
        } else {
            alert("Failed to save remark.");
            btn.textContent = "Save";
            btn.style.opacity = "1";
        }
    } catch (error) {
        console.error("Error saving remark:", error);
        alert("Network error.");
        btn.textContent = "Save";
        btn.style.opacity = "1";
    }
};
// --- UPDATED FILTER LOGIC ---
function filterTable() {
    const start = document.getElementById('filterStartDate').value;
    const end = document.getElementById('filterEndDate').value;
    const priority = document.getElementById('filterPriority').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    const filtered = globalTasks.filter(task => {
        const taskDate = task.date.split('T')[0];
        const matchesDate = (!start || taskDate >= start) && (!end || taskDate <= end);
        const matchesPriority = priority === 'ALL' || task.priority === priority;
        const matchesSearch = task.resp.join(' ').toLowerCase().includes(search) || 
                              task.dept.join(' ').toLowerCase().includes(search);

        return matchesDate && matchesPriority && matchesSearch;
    });

    renderTable(filtered);
}

// --- NEW ANALYTICS LOGIC ---
function renderAnalytics() {
    const stats = {};
    
    globalTasks.forEach(task => {
        task.resp.forEach(person => {
            if (!stats[person]) stats[person] = { triggers: 0, pending: 0 };
            stats[person].triggers += (task.triggerCount || 0);
            if (task.status === 'OPEN') stats[person].pending += 1;
        });
    });

    const tbody = document.getElementById('analyticsBody');
    tbody.innerHTML = '';

    for (const [name, data] of Object.entries(stats)) {
        const row = `<tr>
            <td style="padding:10px; border-bottom:1px solid #ddd;"><b>${name}</b></td>
            <td style="padding:10px; border-bottom:1px solid #ddd; text-align:center;">${data.triggers}</td>
            <td style="padding:10px; border-bottom:1px solid #ddd; text-align:center; color:red;">${data.pending}</td>
        </tr>`;
        tbody.innerHTML += row;
    }
}

// Update openTab to trigger analytics
function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) tabcontent[i].style.display = "none";
    
    const tablinks = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tablinks.length; i++) tablinks[i].classList.remove("active");

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");

    if (tabName === 'historyTab') loadHistory();
    if (tabName === 'analyticsTab') renderAnalytics();
}