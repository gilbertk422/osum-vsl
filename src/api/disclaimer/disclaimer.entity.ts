import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  RelationId
} from 'typeorm';
import {IsString, MaxLength, IsNumber, IsOptional} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Project} from '../project/project.entity';
import {User} from '../user/user.entity';

@Entity()
export class Disclaimer {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column('text')
  @IsString()
  @MaxLength(+process.env.DISCLAIMER_LIMIT)
  text: string;

  // ManyToOne
  @ApiProperty()
  @ManyToOne(type => Project)
  project: Project;

  @ApiPropertyOptional()
  @Column()
  @IsNumber()
  @IsOptional()
  @RelationId('project')
  projectId: number;

  @ApiProperty()
  @ManyToOne(type => User)
  createdBy: User;

  @ApiPropertyOptional()
  @Column()
  @IsNumber()
  @IsOptional()
  @RelationId('createdBy')
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
