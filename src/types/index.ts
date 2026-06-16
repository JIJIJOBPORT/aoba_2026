// 社員マスタ
export interface Employee {
  id: string;
  name: string;
  nameKana: string;
  employmentType: '正社員' | '契約社員' | 'パート' | 'アルバイト';
  department: string;
  position: string;
  hireDate: string;
  birthDate: string;
  email: string;
  phone: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: '普通' | '当座';
  bankAccountNumber: string;
  basicSalary: number;
  allowances: number;
  dependents: number;
  isActive: boolean;
}

// 給与・賞与明細
export interface PayrollRecord {
  id: string;
  employeeId: string;
  paymentMonth: string;         // A: 支給月（YYYY-MM）
  paymentDate: string;          // B: 支払日（YYYY/MM/DD）
  recordType: '給与' | '賞与'; // C
  // 勤怠
  workDays: number;             // D: 出勤日数
  paidLeaveDays: number;        // E: 有給休暇日数
  absentDays: number;           // F: 欠勤日数
  workHours: number;            // G: 勤務時間
  overtimeHours: number;        // H: 残業時間
  // 支給
  basicSalary: number;          // I: 基本給
  positionAllowance: number;    // J: 役職手当
  familyAllowance: number;      // K: 家族手当
  housingAllowance: number;     // L: 住宅手当
  allowances: number;           // M: その他手当
  overtimePay: number;          // N: 時間外手当
  transportAllowance: number;   // O: 交通費（非課税）
  grossPay: number;             // P: 総支給額
  // 控除
  healthInsurance: number;      // Q: 健康保険料
  pensionInsurance: number;     // R: 厚生年金保険料
  employmentInsurance: number;  // S: 雇用保険料
  longCareInsurance: number;    // T: 介護保険料
  childcareSupport: number;     // U: 子ども・子育て支援金
  incomeTax: number;            // V: 所得税
  residentTax: number;          // W: 住民税
  totalDeductions: number;      // X: 控除合計
  netPay: number;               // Y: 差引支給額
  note: string;                 // AB: 備考
  pdfUrl: string;               // AC: PDF保存先URL
}

// 雇用保険料率マスタ
export interface EmploymentInsuranceRate {
  effectiveDate: string;
  generalRate: number;
  constructionRate: number;
}

// 社会保険料率マスタ
export interface SocialInsuranceRate {
  effectiveDate: string;
  healthInsuranceRate: number;
  pensionInsuranceRate: number;
  longCareInsuranceRate: number;
  childcareSupportRate: number;
  prefecture: string;
}

// 有給管理
export interface PaidLeaveRecord {
  employeeId: string;
  fiscalYear: string;
  grantDate: string;
  grantDays: number;
  carryoverDays: number;
  usedDays: number;
  remainingDays: number;
  expiryDate: string;
}

// 有給取得記録
export interface PaidLeaveUsage {
  employeeId: string;
  usedDate: string;
  usedDays: number;
  usageType: '全日' | '半日午前' | '半日午後' | '時間単位';
  note: string;
}
