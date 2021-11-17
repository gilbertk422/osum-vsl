import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  IsNull,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  RelationId
} from 'typeorm';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsString, IsNumber, IsDate, IsOptional, MaxLength} from 'class-validator';
import {User} from '../user/user.entity';
import {Project} from '../project/project.entity';
import {Company} from '../company/company.entity';

@Entity()
export class Job {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column()
  @IsString()
  jobId: string;

  @ApiProperty()
  @Column('text')
  @IsString()
  @MaxLength(+process.env.PROJECT_SCRIPT_LIMIT)
  script: string;

  @ApiProperty()
  @Column({type: 'text', nullable: true})
  @IsString()
  result: string;

  @ApiProperty()
  @Column()
  @IsNumber()
  source: number;

  @ApiProperty()
  @Column()
  @IsNumber()
  status: number;

  @ApiProperty()
  @Column({type: 'text', nullable: true})
  @IsOptional()
  files: string;

  @ApiProperty()
  @Column({nullable: true})
  @IsString()
  @IsOptional()
  step:
    | null
    | 'videorender'
    | 'gentle'
    | 'openai'
    | 'musicai'
    | 'mediapipe'
    | 'googletts'
    | 'ssmlenhancer'
    | 'completed';

  @ApiProperty()
  @Column({type: 'int', nullable: true})
  @IsNumber()
  @IsOptional()
  progress: number;

  @ApiProperty()
  @Column({type: 'varchar', nullable: true})
  @IsString()
  secretKey: string;

  @ApiProperty()
  @Column({type: 'varchar', nullable: true})
  @IsString()
  sourceEmail: string;

  // ManyToOne
  @ApiProperty()
  @ManyToOne(type => Project)
  project: Project;

  @ApiPropertyOptional()
  @Column({type: 'int', nullable: true})
  @IsNumber()
  @IsOptional()
  @RelationId('project')
  projectId: number;

  @ApiProperty()
  @ManyToOne(type => Company)
  company: Company;

  @ApiPropertyOptional()
  @Column({type: 'int', nullable: true})
  @IsNumber()
  @IsOptional()
  @RelationId('company')
  companyId: number;

  @ApiProperty()
  @ManyToOne(type => User)
  createdBy: User;

  @ApiPropertyOptional()
  @Column({type: 'int', nullable: true})
  @IsNumber()
  @IsOptional()
  @RelationId('createdBy')
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
