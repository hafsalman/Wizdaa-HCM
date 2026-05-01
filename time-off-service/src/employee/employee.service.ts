import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly repo: Repository<Employee>,
  ) {}

  async findById(id: string): Promise<Employee> {
    const employee = await this.repo.findOne({
      where: { id },
      relations: ['balances'],
    });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  async findByExternalId(externalId: string): Promise<Employee> {
    const employee = await this.repo.findOne({
      where: { externalId },
      relations: ['balances'],
    });
    if (!employee)
      throw new NotFoundException(
        `Employee with external ID ${externalId} not found`,
      );
    return employee;
  }

  async findAll(): Promise<Employee[]> {
    return this.repo.find({ relations: ['balances'] });
  }

  async create(data: Partial<Employee>): Promise<Employee> {
    const employee = this.repo.create(data);
    return this.repo.save(employee);
  }
}
