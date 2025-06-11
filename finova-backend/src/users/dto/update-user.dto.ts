import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    example: 'Bar Achdut',
    description: 'The updated name of the user',
    required: false,
  })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: 'newpassword123',
    description: 'The updated password for the account',
    required: false,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsOptional()
  password?: string;

  @ApiProperty({
    example: true,
    description: 'Updated pro plan status',
    required: false,
  })
  @IsBoolean({ message: 'pro must be a boolean' })
  @IsOptional()
  pro?: boolean;

  @ApiProperty({
    example: ['TSLA', 'AAPL'],
    description: 'List of stock symbols that the user follows',
    required: false,
    type: [String],
  })
  @IsArray({ message: 'followedStocks must be an array' })
  @IsString({ each: true, message: 'Each stock symbol must be a string' })
  @IsOptional()
  followedStocks?: string[];
}
