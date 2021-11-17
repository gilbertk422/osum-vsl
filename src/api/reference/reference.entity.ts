import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  RelationId
} from 'typeorm';
import {IsString, IsNumber, MaxLength, IsOptional} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {User} from '../user/user.entity';
import {Project} from '../project/project.entity';

@Entity()
export class Reference {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column('text')
  @IsString()
  @MaxLength(+process.env.REFERENCE_LIMIT)
  text: string;

  // ManyToOne
  @ApiProperty()
  @ManyToOne(type => User)
  createdBy: User;

  @ApiPropertyOptional()
  @Column()
  @IsNumber()
  @IsOptional()
  @RelationId('createdBy')
  createdById: number;

  @ApiProperty()
  @ManyToOne(type => Project)
  project: Project;

  @ApiPropertyOptional()
  @Column()
  @IsNumber()
  @IsOptional()
  @RelationId('project')
  projectId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
