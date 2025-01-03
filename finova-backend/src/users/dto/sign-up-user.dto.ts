import { ApiProperty } from '@nestjs/swagger';

export class signUpUserDto {
  @ApiProperty({ example: 'Bar Achdut', description: 'The name of the user' })
  name: string;

  @ApiProperty({ example: 'bar.achdut@example.com', description: 'The email address of the user' })
  email: string;

  @ApiProperty({ example: 'entrepreneur123', description: 'The password for the account' })
  password: string;
}
