/** Presentation vocabulary shared by the exporter and the reader; module IDs stay stable. */
export const readingGroups = ['先看重点', '理解技术', '研究依据', '产品应用', '验证行动', '证据与资料'];
export const modulePresentation = {
  paper: ['理解技术', '这项技术如何工作', '论文与技术解析'],
  'first-principles': ['理解技术', '它改变了什么关键权衡', '第一性原理与主要次要矛盾'],
  beginner: ['理解技术', '用一个例子理解它', '零基础解释与产品示例'],
  landscape: ['研究依据', '这项研究从哪里来', '研究现状、参考文献与研究脉络'],
  sandbox: ['产品应用', '如何用于 Agent 沙箱', 'Agent 沙箱的关系与落地'],
  features: ['产品应用', '可以做成哪些功能', '现有产品的新功能与能力'],
  products: ['产品应用', '有哪些新产品机会', '新产品机会'],
  experience: ['产品应用', '用户体验会怎样改变', '产品体验改进'],
  transfer: ['产品应用', '还能迁移到哪些场景', '跨领域技术迁移'],
  decision: ['验证行动', '下一步值得做什么', '验证计划与行动建议'],
};
export const fieldLabels = Object.fromEntries(`background:研究背景|problem:要解决的问题|oneSentenceIdea:一句话理解|mechanism:关键机制|inputProcessOutput:输入、处理与输出|innovation:真正的新意|experiments:实验与对照|conditions:成立条件|limitations:局限|value:技术价值|beginnerVersion:零基础理解|productManagerVersion:产品视角|engineeringVersion:工程视角|formulas:公式的含义|fundamentalGoal:根本目标|constraints:客观约束|primaryContradiction:主要矛盾及依据|secondaryContradictions:次要矛盾|existingSolution:既有解法|newMechanism:新的解法|costAndBoundary:代价与边界|newContradiction:引入的新矛盾|simplerAlternatives:更简单的替代方案|applicability:适用程度|relatedLayer:对应的系统层次|traditionalApproach:传统做法|integrationChanges:需要改变的组件|interfacesAndResources:接口与资源|metrics:如何衡量效果|risks:风险|horizon:适合何时推进|technicalCapability:技术能做到什么|productCapability:产品能稳定交付什么|userRole:目标用户|scenario:使用场景|painPoint:客户痛点|requirement:需求定义|featureDesign:功能与交互|implementation:实现方式|benefits:预期收益|cost:实现成本|priority:优先级|name:产品名称|concept:产品概念|users:面向谁|capabilities:关键能力|mvp:最小可用产品|businessHypothesis:商业假设|technologyNecessity:是否必须使用这项技术|feasibilityStatus:可行性与证据|beforeJourney:优化前的用户旅程|afterJourney:优化后的用户旅程|usability:易用性|efficiency:效率|reliability:可靠性|transparency:可理解性|control:对照与控制|trust:信任与安全感|automation:自动化|guardrails:不能牺牲的指标|retrievalDate:检索截至日期|origins:技术起源|milestones:关键里程碑|routes:不同技术路线|breakthroughs:关键突破|currentState:当前研究状态|verifiedProgress:已验证的进展|hypothesizedTrends:待验证的趋势|evidenceGaps:证据缺口|reusableMechanism:可复用的机制|sourceDomain:原始场景|targetDomain:目标场景|similarities:相同的问题结构|differences:关键差异|adaptation:迁移需要的改动|lossAndCost:能力损失与成本|experiment:最小验证实验|nonTransferConditions:何时不能迁移|concreteProblem:从一个具体问题开始|intuition:直觉理解|traditionalAnalogy:传统方法的类比|traditionalLimits:传统方式的局限|newIdea:新的思路|workedExample:一步步看例子|concepts:必要概念|productExamples:产品与功能案例|limits:类比与技术的边界|learningPath:继续学习|furtherReading:值得继续阅读|technicalExperiments:值得验证的技术|sandboxRoadmap:沙箱能力规划|prototypeFeatures:值得做的功能原型|productResearch:待调研的产品机会|doNotAdopt:暂不建议采用|valueFeasibilityCostRiskEvidence:价值、成本与证据评估|hypothesis:要验证的假设|steps:实验步骤|resources:必要资源|successCriteria:成功标准|stopConditions:停止条件`.split('|').map(x => x.split(':')));
export function sectionPresentation(title) {
  for (const [id, [group, label, legacy]] of Object.entries(modulePresentation)) {
    if (title === label || title === legacy) return { id, group, label };
  }
  if (/重点概览|阅读与证据边界/.test(title)) return { group: '先看重点', label: title };
  if (/研究时间线/.test(title)) return { group: '研究依据', label: title };
  if (/原文证据|文献索引|来源缺口/.test(title)) return { group: '证据与资料', label: title };
  return { group: '深入阅读', label: title };
}
