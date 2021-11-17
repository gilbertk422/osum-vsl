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
export class Image {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column()
  @IsString()
  @MaxLength(255)
  originalName: string;

  @ApiProperty()
  @Column()
  @IsString()
  @MaxLength(255)
  mimetype: string;

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

  @ApiProperty({type: () => Project})
  @ManyToOne(
    type => Project,
    project => project.images
  )
  project: Project;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
