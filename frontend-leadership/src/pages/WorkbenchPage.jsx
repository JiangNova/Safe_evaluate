import { useEffect, useMemo, useState } from 'react';
import DocumentEditor from '../components/DocumentEditor';
import DocumentHistory from '../components/DocumentHistory';
import ProfileEditor from '../components/ProfileEditor';
import ProfileLibrary from '../components/ProfileLibrary';
import TaskComposer from '../components/TaskComposer';
import { downloadDocument, generateDocument, reviseDocument } from '../services/leaderApi';
import { ensureDefaultProfiles, restoreDefaultProfile } from '../services/defaultProfiles';
import { deleteDocument, deleteProfile, listDocuments, listProfiles, loadDraft, saveDocument, saveDraft, saveProfile, setStorageAccount } from '../services/leaderStorage';
import styles from './WorkbenchPage.module.css';

const EMPTY_PROFILE = { name: '', title: '', organization: '', responsibilities: '', focusAreas: '', writingPreferences: '', notes: '' };

function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function resultDocument(result, context, existing = {}) {
  return {
    ...existing,
    title: result.title || existing.title || '未命名文稿',
    contentMarkdown: result.content_markdown || result.contentMarkdown || existing.contentMarkdown || '',
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    profileSnapshot: snapshot(context.profile),
    taskType: context.taskType,
    requirement: context.requirement,
  };
}

export function profileForRevision(document) {
  return document?.profileSnapshot || null;
}

export function profileForGeneration(document, selectedProfile) {
  return document?.profileSnapshot || selectedProfile || null;
}

function apiErrorMessage(caught, fallback) {
  const detail = caught?.response?.data?.detail;
  return detail?.message || caught?.response?.data?.message || caught?.message || fallback;
}

export default function WorkbenchPage({ accountName, onLogout }) {
  setStorageAccount(accountName);
  const initialDraft = useMemo(() => {
    ensureDefaultProfiles(accountName);
    return loadDraft();
  }, [accountName]);
  const [profiles, setProfiles] = useState(() => listProfiles());
  const [documents, setDocuments] = useState(() => listDocuments());
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const storedProfiles = listProfiles();
    return storedProfiles.some((profile) => profile.id === initialDraft.activeProfileId)
      ? initialDraft.activeProfileId
      : storedProfiles[0]?.id || null;
  });
  const [profileForm, setProfileForm] = useState(() => {
    const match = listProfiles().find((profile) => profile.id === initialDraft.activeProfileId) || listProfiles()[0];
    return snapshot(match || initialDraft.profileForm || EMPTY_PROFILE);
  });
  const [taskType, setTaskType] = useState(initialDraft.taskType || 'implementation_report');
  const [requirement, setRequirement] = useState(initialDraft.requirement || '');
  const [files, setFiles] = useState([]);
  const [currentDocument, setCurrentDocument] = useState(() => initialDraft.currentDocument || null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || null;

  useEffect(() => {
    saveDraft({ activeProfileId, profileForm, taskType, requirement, currentDocument });
  }, [activeProfileId, profileForm, taskType, requirement, currentDocument]);

  const selectProfile = (profileId) => {
    const selected = profiles.find((profile) => profile.id === profileId);
    if (!selected) return;
    setActiveProfileId(profileId);
    setProfileForm(snapshot(selected));
    setError('');
  };

  const createProfile = () => {
    setActiveProfileId(null);
    setProfileForm(snapshot(EMPTY_PROFILE));
    setError('');
  };

  const saveCurrentProfile = () => {
    if (!profileForm.name.trim()) {
      setError('请填写身份档案名称后再保存。');
      return;
    }
    const saved = saveProfile({ ...profileForm, name: profileForm.name.trim() });
    setProfiles(listProfiles());
    setActiveProfileId(saved.id);
    setProfileForm(saved);
    setError('');
    setNotice('身份档案已保存。');
  };

  const removeProfile = (profileId) => {
    const nextProfiles = deleteProfile(profileId);
    setProfiles(nextProfiles);
    if (activeProfileId === profileId) {
      const nextActive = nextProfiles[0] || null;
      setActiveProfileId(nextActive?.id || null);
      setProfileForm(snapshot(nextActive || EMPTY_PROFILE));
    }
    setNotice('身份档案已删除。');
  };

  const restoreDefault = () => {
    const restored = restoreDefaultProfile(accountName);
    if (!restored) return;
    setProfiles(listProfiles());
    setActiveProfileId(restored.id);
    setProfileForm(snapshot(restored));
    setNotice('默认身份档案已恢复。');
    setError('');
  };

  const validateTask = (profile = activeProfile) => {
    if (!profile) {
      setError('请先选择并保存一份身份档案。');
      return false;
    }
    if (!taskType || !requirement.trim()) {
      setError('请选择写作任务，并填写具体要求。');
      return false;
    }
    return true;
  };

  const persistResult = (result, existing, profile = activeProfile) => {
    const document = resultDocument(result, { profile, taskType, requirement }, existing);
    const saved = saveDocument(document);
    setDocuments(listDocuments());
    setCurrentDocument(saved);
    return saved;
  };

  const generate = async (profile = activeProfile, existingDocument = null) => {
    if (!validateTask(profile)) return;
    setError('');
    setNotice('');
    setIsWorking(true);
    try {
      const result = await generateDocument({ profile, taskType, requirement: requirement.trim(), files });
      persistResult(result, existingDocument, profile);
      setNotice('文稿初稿已生成，并保存到本地历史。');
    } catch (caught) {
      setError(apiErrorMessage(caught, '生成失败。请检查网络或材料后重试。'));
    } finally {
      setIsWorking(false);
    }
  };

  const revise = async (instruction) => {
    const revisionProfile = profileForRevision(currentDocument);
    if (!currentDocument) return;
    if (!revisionProfile) {
      setError('该历史文稿缺少身份快照，无法安全改写。');
      return;
    }
    if (!taskType || !requirement.trim()) {
      setError('请选择写作任务，并填写具体要求。');
      return;
    }
    setError('');
    setIsWorking(true);
    try {
      const result = await reviseDocument({
        profile: revisionProfile,
        taskType,
        requirement: requirement.trim(),
        title: currentDocument.title,
        contentMarkdown: currentDocument.contentMarkdown,
        warnings: currentDocument.warnings || [],
        revisionInstruction: instruction,
      });
      persistResult(result, currentDocument, revisionProfile);
      setNotice('文稿已按要求改写。');
    } catch (caught) {
      setError(apiErrorMessage(caught, '改写失败，请稍后重试。'));
    } finally {
      setIsWorking(false);
    }
  };

  const changeDocument = (nextDocument) => {
    setCurrentDocument(nextDocument);
    if (nextDocument.id) {
      const saved = saveDocument(nextDocument);
      setDocuments(listDocuments());
      setCurrentDocument(saved);
    }
  };

  const copyDocument = async () => {
    if (!currentDocument?.contentMarkdown) return;
    try {
      await navigator.clipboard.writeText(currentDocument.contentMarkdown);
      setNotice('全文已复制到剪贴板。');
    } catch {
      setError('复制失败，请手动选中文稿正文复制。');
    }
  };

  const exportWord = async () => {
    if (!currentDocument?.contentMarkdown) return;
    setError('');
    setIsWorking(true);
    try {
      await downloadDocument({ title: currentDocument.title, contentMarkdown: currentDocument.contentMarkdown });
      setNotice('Word 文件已开始下载。');
    } catch (caught) {
      setError(apiErrorMessage(caught, '下载失败，请稍后重试。'));
    } finally {
      setIsWorking(false);
    }
  };

  const openDocument = (document) => {
    setCurrentDocument(snapshot(document));
    setTaskType(document.taskType || taskType);
    setRequirement(document.requirement || requirement);
    const matchingProfile = profiles.find((profile) => profile.id === document.profileSnapshot?.id);
    if (matchingProfile) {
      setActiveProfileId(matchingProfile.id);
      setProfileForm(snapshot(matchingProfile));
    }
    setNotice('已打开本地历史文稿。');
  };

  const removeDocument = (documentId) => {
    const nextDocuments = deleteDocument(documentId);
    setDocuments(nextDocuments);
    if (currentDocument?.id === documentId) setCurrentDocument(null);
  };

  return (
    <main className={`app-shell ${styles.workbench}`}>
      <header className="workbench-header">
        <div><p className="eyebrow">LEADERSHIP WRITING ASSISTANT</p><h1>领导文稿助手</h1></div>
        <div className="workbench-account"><p>结合身份档案、工作要求与参考材料，形成可继续编辑的文稿初稿。</p><button type="button" className="secondary-button" onClick={onLogout}>退出登录</button></div>
      </header>
      {(error || notice) && <div role="status" className={`status-message ${error ? 'is-error' : 'is-success'}`}>{error || notice}</div>}
      <div className="workbench-grid">
        <aside className="left-column">
          <ProfileLibrary profiles={profiles} activeProfileId={activeProfileId} accountName={accountName} onSelect={selectProfile} onCreate={createProfile} onDelete={removeProfile} onRestoreDefault={restoreDefault} />
          <ProfileEditor profile={profileForm} isNew={!activeProfile} onChange={(key, value) => setProfileForm((current) => ({ ...current, [key]: value }))} onSave={saveCurrentProfile} onCancel={() => activeProfile && setProfileForm(snapshot(activeProfile))} />
        </aside>
        <section className="center-column">
          <TaskComposer taskType={taskType} requirement={requirement} files={files} onTaskChange={setTaskType} onRequirementChange={setRequirement} onFilesChange={(selectedFiles) => setFiles(Array.from(selectedFiles || []))} disabled={!activeProfile} />
          <button type="button" className="primary-button generate-button" disabled={isWorking || !activeProfile || !requirement.trim()} onClick={() => generate()}>{isWorking ? '正在生成…' : '生成文稿初稿'}</button>
        </section>
        <aside className="right-column">
          <DocumentEditor document={currentDocument} isWorking={isWorking} onContentChange={changeDocument} onRegenerate={() => generate(profileForGeneration(currentDocument, activeProfile), currentDocument)} onRevise={revise} onCopy={copyDocument} onDownload={exportWord} />
          <DocumentHistory documents={documents} activeDocumentId={currentDocument?.id} onOpen={openDocument} onDelete={removeDocument} />
        </aside>
      </div>
    </main>
  );
}
