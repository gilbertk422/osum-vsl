import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne
} from 'typeorm';
import {IsString, MaxLength, IsNumber} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {Disclaimer} from '../disclaimer/disclaimer.entity';
import {Image} from '../image/image.entity';
import {Company} from '../company/company.entity';

@Entity()
export class User {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column()
  @IsString()
  @MaxLength(255)
  auth0id: string;

  @ApiProperty({ type: () => Company })
  @ManyToOne(type => Company)
  company: Company;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
