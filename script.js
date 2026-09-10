document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridContainer = document.getElementById('grid-container');
    const studentPool = document.getElementById('student-pool');
    const captureArea = document.getElementById('capture-area');
    const studentCountEl = document.getElementById('student-count');
    const draftModal = document.getElementById('draft-modal');
    const draftList = document.getElementById('draft-list');

    // Inputs
    const inputCols = document.getElementById('input-cols');
    const inputRows = document.getElementById('input-rows');
    const inputSchool = document.getElementById('input-school');
    const inputCourse = document.getElementById('input-course');
    const inputTime = document.getElementById('input-time');
    const inputClassroom = document.getElementById('input-classroom');
    const inputStudents = document.getElementById('input-students');

    // Displays
    const displaySchool = document.getElementById('display-school');
    const displayCourse = document.getElementById('display-course');
    const displayTime = document.getElementById('display-time');
    const displayClassroom = document.getElementById('display-classroom');

    const btnGenerateGrid = document.getElementById('btn-generate-grid');
    const btnAddDoor = document.getElementById('btn-add-door');
    const btnImportStudents = document.getElementById('btn-import-students');
    const btnExportImg = document.getElementById('btn-export-img');
    const btnExportExcel = document.getElementById('btn-export-excel');
    const btnSaveDraft = document.getElementById('btn-save-draft');
    const btnLoadDraft = document.getElementById('btn-load-draft');
    const btnClearAll = document.getElementById('btn-clear-all');
    const modalClose = document.getElementById('modal-close');

    // --- State ---
    let doors = []; // Array of door objects { id, element }
    let sortables = []; // Keep track of Sortable instances
    let widenCols = new Set();
    let widenRows = new Set();

    // Interactive Gap Toggle Setup
    const gapIndicator = document.createElement('div');
    gapIndicator.style.position = 'absolute';
    gapIndicator.style.backgroundColor = 'rgba(0, 150, 255, 0.2)';
    gapIndicator.style.pointerEvents = 'none';
    gapIndicator.style.display = 'none';
    gapIndicator.style.borderRadius = '4px';
    gapIndicator.style.zIndex = '10';
    let hoverGap = null;

    // --- Init ---
    initGrid();
    setupEventListeners();
    setupSortableForPool();

    // --- Functions ---
    function setupEventListeners() {
        // Metadata mirroring
        inputSchool.addEventListener('input', () => displaySchool.textContent = inputSchool.value);
        inputCourse.addEventListener('input', () => displayCourse.textContent = inputCourse.value);
        inputTime.addEventListener('input', () => displayTime.textContent = inputTime.value);
        inputClassroom.addEventListener('input', () => displayClassroom.textContent = inputClassroom.value);

        btnGenerateGrid.addEventListener('click', initGrid);
        btnImportStudents.addEventListener('click', importStudents);
        btnAddDoor.addEventListener('click', addDoor);
        
        btnExportImg.addEventListener('click', exportImage);
        btnExportExcel.addEventListener('click', exportExcel);
        
        btnSaveDraft.addEventListener('click', saveDraft);
        btnLoadDraft.addEventListener('click', openDraftModal);
        btnClearAll.addEventListener('click', clearAll);

        modalClose.addEventListener('click', () => draftModal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target == draftModal) draftModal.style.display = 'none';
        });
    }

    function initGrid() {
        const cols = parseInt(inputCols.value) || 6;
        const rows = parseInt(inputRows.value) || 5;

        gridContainer.innerHTML = '';
        gridContainer.style.position = 'relative';
        
        // Statically center the layout wrapper so it anchors left and doesn't shift when walkways are added
        const initialWidth = cols * 60 + (cols - 1) * 10;
        const layoutWrapper = document.getElementById('layout-wrapper');
        if (layoutWrapper) {
            layoutWrapper.style.marginLeft = `calc(50% - ${initialWidth / 2}px)`;
            layoutWrapper.style.marginTop = '20px';
        }
        gridContainer.style.marginLeft = '0';
        gridContainer.style.marginTop = '0';
        // Save existing students in grid back to pool or keep them if possible
        // For simplicity, we just clear the grid. Users should generate grid first.
        const existingStudents = Array.from(gridContainer.querySelectorAll('.student-icon'));
        existingStudents.forEach(el => studentPool.appendChild(el));
        updateStudentCount();

        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        
        // Destroy old sortables
        sortables.forEach(s => s.destroy());
        sortables = [];

        // Create seats
        for (let i = 0; i < rows * cols; i++) {
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.dataset.index = i;
            gridContainer.appendChild(seat);

            // Make seat droppable
            const sortable = new Sortable(seat, {
                group: 'students',
                animation: 150,
                ghostClass: 'sortable-ghost',
                onAdd: function (evt) {
                    // A seat can only hold 1 student. If there's already one, swap it or put it back to pool.
                    const itemEl = evt.item;  // dragged HTMLElement
                    const targetSeat = evt.to;    // target list
                    
                    if (targetSeat.children.length > 1) {
                        // Find the other element that was already there
                        const existingItem = Array.from(targetSeat.children).find(el => el !== itemEl);
                        if (existingItem) {
                            // Put existing item back to pool
                            studentPool.appendChild(existingItem);
                        }
                    }
                }
            });
            sortables.push(sortable);
        }
        
        applyGaps();
        gridContainer.appendChild(gapIndicator);
    }

    function applyGaps() {
        const cols = parseInt(inputCols.value) || 6;
        const rows = parseInt(inputRows.value) || 5;

        const colTemplates = [];
        for (let c = 0; c < cols; c++) {
            colTemplates.push(widenCols.has(c) ? '100px' : '60px');
        }
        gridContainer.style.gridTemplateColumns = colTemplates.join(' ');

        const rowTemplates = [];
        for (let r = 0; r < rows; r++) {
            rowTemplates.push(widenRows.has(r) ? '100px' : '60px');
        }
        gridContainer.style.gridTemplateRows = rowTemplates.join(' ');
        
        // Ensure no margins are left on seats
        const seats = Array.from(gridContainer.querySelectorAll('.seat'));
        seats.forEach(seat => {
            seat.style.marginRight = '0px';
            seat.style.marginBottom = '0px';
        });
    }

    // Hover detection for gap toggle
    gridContainer.addEventListener('mousemove', (e) => {
        const rect = gridContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const cols = parseInt(inputCols.value) || 6;
        const rows = parseInt(inputRows.value) || 5;
        const seats = Array.from(gridContainer.querySelectorAll('.seat'));
        
        let found = null;

        // Check vertical gaps
        for (let c = 0; c < cols - 1; c++) {
            const leftSeat = seats[c];
            if (leftSeat) {
                const gapStart = leftSeat.offsetLeft + leftSeat.offsetWidth;
                const nextSeat = seats[c + 1];
                const gapEnd = nextSeat ? nextSeat.offsetLeft : gapStart + 10;
                
                if (mouseX >= gapStart - 10 && mouseX <= gapEnd + 10 && gapEnd >= gapStart) {
                    found = { type: 'v', index: c, gapStart, gapEnd: Math.max(gapEnd, gapStart + 10) };
                    break;
                }
            }
        }

        if (!found) {
            for (let r = 0; r < rows - 1; r++) {
                const topSeat = seats[r * cols];
                if (topSeat) {
                    const gapStart = topSeat.offsetTop + topSeat.offsetHeight;
                    const bottomSeat = seats[(r + 1) * cols];
                    const gapEnd = bottomSeat ? bottomSeat.offsetTop : gapStart + 10;
                    
                    if (mouseY >= gapStart - 10 && mouseY <= gapEnd + 10 && gapEnd >= gapStart) {
                        found = { type: 'h', index: r, gapStart, gapEnd: Math.max(gapEnd, gapStart + 10) };
                        break;
                    }
                }
            }
        }

        hoverGap = found;
        if (found) {
            gapIndicator.style.display = 'block';
            if (found.type === 'v') {
                gapIndicator.style.left = found.gapStart + 'px';
                gapIndicator.style.width = (found.gapEnd - found.gapStart) + 'px';
                gapIndicator.style.top = '0';
                gapIndicator.style.height = gridContainer.scrollHeight + 'px';
            } else {
                gapIndicator.style.top = found.gapStart + 'px';
                gapIndicator.style.height = (found.gapEnd - found.gapStart) + 'px';
                gapIndicator.style.left = '0';
                gapIndicator.style.width = gridContainer.scrollWidth + 'px';
            }
            gridContainer.style.cursor = 'pointer';
        } else {
            gapIndicator.style.display = 'none';
            gridContainer.style.cursor = 'default';
        }
    });

    gridContainer.addEventListener('mouseleave', () => {
        gapIndicator.style.display = 'none';
        hoverGap = null;
        gridContainer.style.cursor = 'default';
    });

    gridContainer.addEventListener('click', (e) => {
        if (hoverGap && !e.target.closest('.seat')) {
            if (hoverGap.type === 'v') {
                if (widenCols.has(hoverGap.index)) widenCols.delete(hoverGap.index);
                else widenCols.add(hoverGap.index);
            } else {
                if (widenRows.has(hoverGap.index)) widenRows.delete(hoverGap.index);
                else widenRows.add(hoverGap.index);
            }
            applyGaps();
            
            gapIndicator.style.display = 'none';
            hoverGap = null;
        }
    });

    function setupSortableForPool() {
        new Sortable(studentPool, {
            group: 'students',
            animation: 150,
            ghostClass: 'sortable-ghost'
        });
    }

    function importStudents() {
        const text = inputStudents.value.trim();
        if (!text) return;

        // Split by newline, comma, or space
        const names = text.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '');
        
        names.forEach(name => {
            const icon = document.createElement('div');
            icon.className = 'student-icon';
            icon.textContent = name;
            icon.dataset.name = name;
            studentPool.appendChild(icon);
        });

        inputStudents.value = '';
        updateStudentCount();
    }

    function updateStudentCount() {
        studentCountEl.textContent = studentPool.children.length;
    }

    // --- Door Dragging Logic ---
    let isDraggingDoor = false;
    let currentDoor = null;
    let offsetX, offsetY;

    function addDoor() {
        const door = document.createElement('div');
        door.className = 'door';
        door.textContent = '門';
        door.id = 'door-' + Date.now();
        
        // Default position
        door.style.left = '-20px';
        door.style.top = '50px';
        
        door.addEventListener('mousedown', startDragDoor);
        door.addEventListener('dblclick', () => {
            doors = doors.filter(d => d.id !== door.id);
            door.remove();
        });
        
        captureArea.appendChild(door);
        doors.push({ id: door.id, element: door });
    }

    function startDragDoor(e) {
        isDraggingDoor = true;
        currentDoor = e.target;
        
        const rect = currentDoor.getBoundingClientRect();
        const parentRect = captureArea.getBoundingClientRect();
        
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        document.addEventListener('mousemove', dragDoor);
        document.addEventListener('mouseup', stopDragDoor);
    }

    function dragDoor(e) {
        if (!isDraggingDoor || !currentDoor) return;
        
        const parentRect = captureArea.getBoundingClientRect();
        
        let newX = e.clientX - parentRect.left - offsetX;
        let newY = e.clientY - parentRect.top - offsetY;

        const maxX = parentRect.width - currentDoor.offsetWidth;
        const maxY = parentRect.height - currentDoor.offsetHeight;

        // Snap to nearest boundary
        const distLeft = Math.abs(newX);
        const distRight = Math.abs(maxX - newX);
        const distTop = Math.abs(newY);
        const distBottom = Math.abs(maxY - newY);

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        if (minDist === distLeft) {
            newX = -10; // Stick out slightly
            newY = Math.max(-10, Math.min(newY, maxY + 10));
        } else if (minDist === distRight) {
            newX = maxX + 10;
            newY = Math.max(-10, Math.min(newY, maxY + 10));
        } else if (minDist === distTop) {
            newY = -10;
            newX = Math.max(-10, Math.min(newX, maxX + 10));
        } else if (minDist === distBottom) {
            newY = maxY + 10;
            newX = Math.max(-10, Math.min(newX, maxX + 10));
        }

        currentDoor.style.left = `${newX}px`;
        currentDoor.style.top = `${newY}px`;
    }

    function stopDragDoor() {
        isDraggingDoor = false;
        currentDoor = null;
        document.removeEventListener('mousemove', dragDoor);
        document.removeEventListener('mouseup', stopDragDoor);
    }

    // --- Export ---
    function exportImage() {
        html2canvas(captureArea).then(canvas => {
            const link = document.createElement('a');
            link.download = 'classroom-seating.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    function exportExcel() {
        const cols = parseInt(inputCols.value);
        const rows = parseInt(inputRows.value);
        
        const seats = Array.from(gridContainer.children);
        let data = [];
        
        for (let r = 0; r < rows; r++) {
            let rowData = [];
            for (let c = 0; c < cols; c++) {
                const index = r * cols + c;
                const seat = seats[index];
                const student = seat.querySelector('.student-icon');
                rowData.push(student ? student.textContent : '');
            }
            data.push(rowData);
        }

        // Add podium row
        let podiumRow = new Array(cols).fill('');
        podiumRow[Math.floor(cols/2)] = '講台';
        data.push(podiumRow);

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "座位表");
        
        const filename = inputCourse.value ? `${inputCourse.value}-座位表.xlsx` : '座位表.xlsx';
        XLSX.writeFile(wb, filename);
    }

    // --- Draft System ---
    function getDrafts() {
        const drafts = localStorage.getItem('seatingDrafts');
        return drafts ? JSON.parse(drafts) : [];
    }

    function saveDraft() {
        const schoolName = inputSchool.value.trim();
        const courseName = inputCourse.value.trim();
        
        let draftTitle = '';
        if (schoolName && courseName) draftTitle = `${schoolName} ${courseName}`;
        else if (schoolName) draftTitle = schoolName;
        else if (courseName) draftTitle = courseName;
        else draftTitle = '未命名課程';

        const timestamp = new Date().toLocaleString();
        const draftName = `${draftTitle} (${timestamp})`;

        // Serialize state
        const draftData = {
            id: Date.now().toString(),
            name: draftName,
            metadata: {
                school: inputSchool.value,
                course: inputCourse.value,
                time: inputTime.value,
                classroom: inputClassroom.value,
                cols: inputCols.value,
                rows: inputRows.value,
                widenCols: Array.from(widenCols),
                widenRows: Array.from(widenRows)
            },
            doors: doors.map(d => ({
                id: d.id,
                left: d.element.style.left,
                top: d.element.style.top
            })),
            gridSeats: Array.from(gridContainer.children).map(seat => {
                const student = seat.querySelector('.student-icon');
                return student ? student.textContent : null;
            }),
            poolStudents: Array.from(studentPool.children).map(s => s.textContent)
        };

        let drafts = getDrafts();
        drafts.push(draftData);
        localStorage.setItem('seatingDrafts', JSON.stringify(drafts));
        alert('草稿已儲存！');
    }

    function openDraftModal() {
        const drafts = getDrafts();
        draftList.innerHTML = '';
        
        if (drafts.length === 0) {
            draftList.innerHTML = '<li>目前沒有已儲存的草稿</li>';
        } else {
            drafts.forEach(draft => {
                const li = document.createElement('li');
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = draft.name;
                
                const btnGroup = document.createElement('div');
                
                const loadBtn = document.createElement('button');
                loadBtn.className = 'btn-primary';
                loadBtn.textContent = '載入';
                loadBtn.onclick = () => loadDraft(draft);
                
                const delBtn = document.createElement('button');
                delBtn.className = 'btn-danger';
                delBtn.textContent = '刪除';
                delBtn.onclick = () => deleteDraft(draft.id);

                btnGroup.appendChild(loadBtn);
                btnGroup.appendChild(delBtn);
                
                li.appendChild(nameSpan);
                li.appendChild(btnGroup);
                draftList.appendChild(li);
            });
        }
        
        draftModal.style.display = 'flex';
    }

    function loadDraft(draft) {
        // Load metadata
        inputSchool.value = draft.metadata.school;
        inputCourse.value = draft.metadata.course;
        inputTime.value = draft.metadata.time;
        inputClassroom.value = draft.metadata.classroom;
        
        inputCols.value = draft.metadata.cols;
        inputRows.value = draft.metadata.rows;
        widenCols = new Set(draft.metadata.widenCols || []);
        widenRows = new Set(draft.metadata.widenRows || []);

        // Trigger input events to update display
        inputSchool.dispatchEvent(new Event('input'));
        inputCourse.dispatchEvent(new Event('input'));
        inputTime.dispatchEvent(new Event('input'));
        inputClassroom.dispatchEvent(new Event('input'));

        // Load grid
        initGrid();
        
        // Load students into grid
        const seats = Array.from(gridContainer.children);
        draft.gridSeats.forEach((studentName, index) => {
            if (studentName) {
                const icon = document.createElement('div');
                icon.className = 'student-icon';
                icon.textContent = studentName;
                seats[index].appendChild(icon);
            }
        });

        // Load students into pool
        studentPool.innerHTML = '';
        draft.poolStudents.forEach(studentName => {
            const icon = document.createElement('div');
            icon.className = 'student-icon';
            icon.textContent = studentName;
            studentPool.appendChild(icon);
        });

        updateStudentCount();

        // Load doors
        doors.forEach(d => d.element.remove());
        doors = [];
        if (draft.doors) {
            draft.doors.forEach(dData => {
                const door = document.createElement('div');
                door.className = 'door';
                door.textContent = '門';
                door.id = dData.id;
                door.style.left = dData.left;
                door.style.top = dData.top;
                door.addEventListener('mousedown', startDragDoor);
                door.addEventListener('dblclick', () => {
                    doors = doors.filter(d => d.id !== door.id);
                    door.remove();
                });
                captureArea.appendChild(door);
                doors.push({ id: door.id, element: door });
            });
        }

        draftModal.style.display = 'none';
    }

    function deleteDraft(id) {
        let drafts = getDrafts();
        drafts = drafts.filter(d => d.id !== id);
        localStorage.setItem('seatingDrafts', JSON.stringify(drafts));
        openDraftModal(); // Refresh list
    }

    function clearAll() {
        if(confirm('確定要清除畫面上所有的資料嗎？')) {
            inputSchool.value = '';
            inputCourse.value = '';
            inputTime.value = '';
            inputClassroom.value = '';
            inputSchool.dispatchEvent(new Event('input'));
            inputCourse.dispatchEvent(new Event('input'));
            inputTime.dispatchEvent(new Event('input'));
            inputClassroom.dispatchEvent(new Event('input'));

            inputCols.value = '6';
            inputRows.value = '5';
            initGrid();
            
            studentPool.innerHTML = '';
            updateStudentCount();

            doors.forEach(d => d.element.remove());
            doors = [];

            widenCols.clear();
            widenRows.clear();
            applyGaps();
        }
    }
});
