import { defaultsWereInitialized, listProfiles, markDefaultsInitialized, saveProfile } from './leaderStorage';

const ORGANIZATION = '长沙理工大学人工智能学院';

export const DEFAULT_PROFILES = {
  wanxin: {
    defaultProfileKey: 'wanxin-secretary',
    name: 'wanxin1',
    title: '党委书记',
    organization: ORGANIZATION,
    responsibilities: '党委书记是学院党组织的负责人，确保学院办学方向和立德树人根本任务得到贯彻执行。主持党委全面工作，召集党委委员会和党员大会，规划、制定并实施年度与学期工作计划；组织党员和干部学习党的理论、路线、方针、政策，指导下级党支部开展活动；对学院重大事项进行政治把关，确保学院发展与党的教育方针保持一致；分管学生工作、关工委、就业、工会、宣传及纪检监察等工作。',
    focusAreas: '党建与思想政治工作、学生工作、关工委、就业、工会、宣传、纪检监察',
    writingPreferences: '正式、规范，突出政治把关、立德树人和学院实际。',
    notes: '对于涉及安全、科研、教学等事项，应结合人工智能学院的具体场景提出落实要求。',
  },
  wanqin: {
    defaultProfileKey: 'wanqin-dean',
    name: 'wanqin1',
    title: '院长',
    organization: ORGANIZATION,
    responsibilities: '院长是学院行政主要负责人，对学院学术和行政事务负总责。主持行政全面工作，统筹管理学院各项行政事务；制定学院整体发展战略，重点推进学科建设、科学研究和人才培养；全面负责教学、实验室建设、招生及资产管理等核心业务，规范教学管理并推进相关工作机制建设；负责学院人事工作，协管学科建设与科研；代表学院参加校内外重要活动与调研交流。',
    focusAreas: '学科建设、科学研究、人才培养、教学管理、实验室建设、招生、资产管理、人事工作',
    writingPreferences: '正式、务实，突出发展战略、学术建设和行政执行。',
    notes: '对于涉及安全、科研、教学等事项，应结合人工智能学院的具体场景提出落实要求。',
  },
};

function profileForAccount(username) {
  return DEFAULT_PROFILES[username] || null;
}

export function ensureDefaultProfiles(username) {
  if (defaultsWereInitialized()) return listProfiles();
  const defaultProfile = profileForAccount(username);
  if (defaultProfile) saveProfile(defaultProfile);
  markDefaultsInitialized();
  return listProfiles();
}

export function restoreDefaultProfile(username) {
  const defaultProfile = profileForAccount(username);
  if (!defaultProfile) return null;
  const existing = listProfiles().find((profile) => profile.defaultProfileKey === defaultProfile.defaultProfileKey);
  return existing || saveProfile(defaultProfile);
}
