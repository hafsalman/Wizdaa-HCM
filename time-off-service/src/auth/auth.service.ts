import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee, EmployeeRole } from '../employee/employee.entity';
import { BalanceService } from '../balance/balance.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    private readonly balanceService: BalanceService,
  ) {}

  /**
   * Generate a JWT for a given employee (used for development/testing).
   * In production, tokens would come from Supabase Auth.
   */
  async generateToken(employeeId: string): Promise<{ accessToken: string }> {
    const employee = await this.employeeRepo.findOneOrFail({
      where: { id: employeeId },
    });

    const payload = {
      sub: employee.id,
      email: employee.email,
      role: employee.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  /**
   * Seed a test employee and return a token — development only.
   * Also initializes leave balances from HCM for new employees.
   */
  async seedAndGetToken(
    name: string,
    email: string,
    role: EmployeeRole = EmployeeRole.EMPLOYEE,
  ): Promise<{ accessToken: string; employee: Employee }> {
    let employee = await this.employeeRepo.findOne({ where: { email } });

    if (!employee) {
      employee = this.employeeRepo.create({
        externalId: `HCM-${Date.now()}`,
        name,
        email,
        role,
        timezone: 'Asia/Karachi',
      });
      employee = await this.employeeRepo.save(employee);
    }

    // Auto-create leave balances from HCM if employee has none yet
    try {
      const existingBalances = await this.balanceService.getBalance(
        employee.id,
        'PKR-01',
      );
      if (existingBalances.length === 0) {
        await this.balanceService.refreshFromHcm(employee.id, 'PKR-01');
        this.logger.log(`Initialized balances from HCM for employee: ${employee.email}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize balances for ${employee.email}: ${error}`);
    }

    const token = await this.generateToken(employee.id);
    return { ...token, employee };
  }
}
