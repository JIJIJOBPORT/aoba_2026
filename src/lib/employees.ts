import { getSheetRows, SHEETS } from './sheets';
import { Employee } from '@/types';

export async function getAllEmployees(): Promise<Employee[]> {
  const rows = await getSheetRows(SHEETS.EMPLOYEES);
  return rows
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0] ?? '',
      name: row[1] ?? '',
      nameKana: row[2] ?? '',
      employmentType: (row[3] as Employee['employmentType']) ?? '正社員',
      department: row[4] ?? '',
      position: row[5] ?? '',
      hireDate: row[6] ?? '',
      birthDate: row[7] ?? '',
      email: row[8] ?? '',
      phone: row[9] ?? '',
      bankName: row[10] ?? '',
      bankBranch: row[11] ?? '',
      bankAccountType: (row[12] as Employee['bankAccountType']) ?? '普通',
      bankAccountNumber: row[13] ?? '',
      basicSalary: Number(row[14]) || 0,
      allowances: Number(row[15]) || 0,
      dependents: Number(row[16]) || 0,
      isActive: row[17]?.toUpperCase() === 'TRUE',
    }));
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const employees = await getAllEmployees();
  return employees.find((e) => e.id === id) ?? null;
}
