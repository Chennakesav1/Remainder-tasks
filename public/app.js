
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

    
    if (tabName === 'historyTab') {
        loadHistory();
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
    "NANI": "narasimha.nath@precifast.in"
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

async function loadHistory() {
    try {
        const response = await fetch('/api/tasks');
        const tasks = await response.json();
        
        const tbody = document.getElementById('historyBody');
        tbody.innerHTML = ''; 

        tasks.forEach((task, index) => {
            const row = document.createElement('tr');
            
            // Format Acknowledgment status
            let ackStatus = task.acknowledged ? 
                '<span style="color:#003366; font-size:0.8rem; display:block; margin-top:5px;">✓ Read, replied OK</span>' : '';

            // Format Attachments as clickable links
            let attachmentLinks = '';
            if (task.attachments && task.attachments.length > 0) {
                attachmentLinks = task.attachments.map((filePath, i) => 
                    `<a href="${filePath}" target="_blank" style="color:var(--primary-blue); font-weight:bold; display:block;">View File ${i+1}</a>`
                ).join('');
            }

            // Format Closure info (Removed the edit button from here)
            let closureInfo = '';
            if (task.status === 'CLOSED') {
                closureInfo = `
                    <div style="font-size: 0.85rem;">
                        <b>Remarks:</b> <span id="remark-text-${task._id}">${task.closingRemarks || 'N/A'}</span><br>
                        ${attachmentLinks}
                    </div>
                `;
            }

            // ADDED THE EXTRA <td> AT THE END FOR THE EDIT BUTTON
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${task.priority || ''}</td>
                <td>${(task.dept || []).join(', ')}</td>
                <td>${formatDate(task.date)}</td>
                <td>${task.mom || ''}</td>
                <td>${task.action || ''}</td>
                <td>${(task.resp || []).join(', ')}</td>
                <td>${formatDate(task.targetDate)}</td>
                <td>
                    <span class="status-${task.status.toLowerCase()}">${task.status}</span>
                    ${task.status === 'OPEN' ? ackStatus : ''}
                </td>
                <td>${closureInfo}</td>
                <td>
                    <button onclick="editRemark('${task._id}')" class="action-edit-btn">✎ Edit</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading history:", error);
    }
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
    statusDiv.style.color = "#003366"; // Theme Blue

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });

        const result = await response.json();

        if (response.ok) {
            statusDiv.textContent = "Task recorded. Initial email sent and 3-hour trigger activated.";
            statusDiv.style.color = "#28a745"; 
            
            document.getElementById('taskForm').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            
            
            loadHistory(); 
        } else {
            statusDiv.textContent = "Error: " + result.error;
            statusDiv.style.color = "#dc3545"; // Error Red
        }
    } catch (error) {
        console.error('Error:', error);
        statusDiv.textContent = "Failed to connect to the server.";
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