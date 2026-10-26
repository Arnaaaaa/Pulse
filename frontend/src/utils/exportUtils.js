export function downloadCSV(filename, headers, rows) {
  const escapeCell = (val) => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTasksToCSV(tasks, projects, users, filename = "pulse-tasks.csv") {
  const headers = [
    "ID",
    "Title",
    "Type",
    "Severity",
    "Project",
    "Status",
    "Priority",
    "Assignee",
    "Due Date",
    "Estimate (h)",
    "Time Logged (h)",
    "Tags",
  ];

  const rows = tasks.map((t) => {
    const proj = projects.find((p) => p.id === t.projectId);
    const user = users.find((u) => u.id === t.assigneeId);
    return [
      t.id,
      t.title,
      t.type || "Task",
      t.severity || "",
      proj?.name || t.projectId,
      t.status,
      t.priority,
      user?.name || "Unassigned",
      t.dueDate || "",
      t.estimate ?? 0,
      t.timeLogged ?? 0,
      (t.tags || []).join("; "),
    ];
  });

  downloadCSV(filename, headers, rows);
}

export function exportProjectsToCSV(projects, tasks, filename = "pulse-projects.csv") {
  const headers = [
    "ID",
    "Project Name",
    "Status",
    "Template",
    "Start Date",
    "End Date",
    "Team Size",
    "Total Tasks",
    "Completed Tasks",
    "Completion %",
  ];

  const rows = projects.map((p) => {
    const pTasks = tasks.filter((t) => t.projectId === p.id);
    const done = pTasks.filter((t) => t.status === "Completed").length;
    const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
    return [
      p.id,
      p.name,
      p.status,
      p.template,
      p.startDate,
      p.endDate,
      (p.memberIds || []).length,
      pTasks.length,
      done,
      `${pct}%`,
    ];
  });

  downloadCSV(filename, headers, rows);
}

export function triggerPrintPDF() {
  window.print();
}
