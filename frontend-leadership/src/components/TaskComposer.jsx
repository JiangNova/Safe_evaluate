export const TASKS = [
  { id: 'implementation_report', label: '文件贯彻落实报告', description: '围绕文件要求形成可执行的落实思路。' },
  { id: 'safety_deployment', label: '安全工作部署', description: '明确风险重点、责任分工和工作安排。' },
  { id: 'speech', label: '领导讲话稿', description: '生成会议、动员或活动中的发言初稿。' },
  { id: 'summary', label: '工作总结', description: '梳理工作进展、成效与下一步安排。' },
  { id: 'notice', label: '通知/函件', description: '拟定正式、清晰的工作通知或函件。' },
  { id: 'custom', label: '自定义任务', description: '按你的具体目标组织一份全新文稿。' },
];

export default function TaskComposer({ taskType, requirement, files, onTaskChange, onRequirementChange, onFilesChange, disabled }) {
  const fileNames = Array.from(files || []).map((file) => file.name);
  return (
    <section className="panel task-composer" aria-label="写作任务">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">写作任务</p>
          <h2>这次要完成什么？</h2>
        </div>
      </div>
      <div className="task-grid">
        {TASKS.map((task) => (
          <button
            type="button"
            key={task.id}
            className={`task-card ${taskType === task.id ? 'is-selected' : ''}`}
            onClick={() => onTaskChange(task.id)}
          >
            <strong>{task.label}</strong>
            <span>{task.description}</span>
          </button>
        ))}
      </div>
      <label className="field requirement-field">
        <span>具体要求 <em>*</em></span>
        <textarea
          value={requirement}
          rows="7"
          placeholder="请说明背景、使用场景、对象、篇幅、需要重点回应的问题，以及已有的事实材料。"
          onChange={(event) => onRequirementChange(event.target.value)}
        />
      </label>
      <label className="file-picker">
        <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" multiple onChange={(event) => onFilesChange(event.target.files)} />
        <span>添加参考文件</span>
        <small>支持 PDF、DOCX、TXT；文件只用于本次生成。</small>
      </label>
      {fileNames.length > 0 && <div className="file-list">已选：{fileNames.join('、')}</div>}
      {disabled && <p className="validation-note">请先在左侧选择并保存一份身份档案。</p>}
    </section>
  );
}
