import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, IsNull} from 'typeorm';
import {IsOptional, IsString, MaxLength} from 'class-validator';
import {ApiProperty} from '@nestjs/swagger';
import {Controller} from '@nestjs/common';
import {User} from '../user/user.entity';

@Entity()
export class Company {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column({nullable: true})
  @IsString()
  @MaxLength(50)
  @IsOptional()
  name: string;

  // ManyToOne
  @ApiProperty({type: () => User})
  @ManyToOne(type => User)
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
