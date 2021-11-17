import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  RelationId
} from 'typeorm';
import {IsString, MaxLength, IsNumber, IsOptional} from 'class-validator';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Image} from '../image/image.entity';
import {Disclaimer} from '../disclaimer/disclaimer.entity';
import {Company} from '../company/company.entity';
import {User} from '../user/user.entity';
import {Reference} from '../reference/reference.entity';

@Entity()
export class Project {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @Column()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty()
  @Column('text')
  @IsString()
  @MaxLength(+process.env.PROJECT_SCRIPT_LIMIT)
  script: string;

  @ApiProperty()
  @Column()
  @IsNumber()
  videosPercent: number;

  @ApiProperty()
  @Column()
  @IsNumber()
  useVidux: number;

  @ApiProperty()
  @Column()
  @IsString()
  voiceGender: 'male' | 'female';

  // ManyToOne
  @ApiProperty({type: () => Company})
  @ManyToOne(type => Company)
  company: Company;

  @ApiPropertyOptional()
  @Column()
  @IsNumber()
  @IsOptional()
  @RelationId('company')
  companyId: number;

  @ApiProperty({type: () => User})
  @ManyToOne(type => User)
  createdBy: User;

  @ApiPropertyOptional()
  @Column()
  @IsNumber()
  @IsOptional()
  @RelationId('createdBy')
  createdById: number;

  @ApiProperty({type: () => User})
  @ManyToOne(type => User)
  modifiedBy: User;

  @ApiPropertyOptional()
  @Column()
  @IsNumber()
  @IsOptional()
  @RelationId('modifiedBy')
  modifiedById: number;

  // OneToMany
  @ApiProperty()
  @OneToMany(
    type => Image,
    image => image.project
  )
  images: Image[];

  @ApiProperty()
  @OneToMany(
    type => Disclaimer,
    disclaimer => disclaimer.project
  )
  disclaimers: Disclaimer[];

  @ApiProperty()
  @OneToMany(
    type => Reference,
    reference => reference.project
  )
  references: Reference[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
