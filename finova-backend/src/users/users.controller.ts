import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SignUpUserDto } from './dto/sign-up-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('SignUpUser')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignUpUserDto, description: 'The required data for registering a new user' })
  async signUpUser(@Body() signUpUserRequest: SignUpUserDto) {
    return this.usersService.signUpUser(signUpUserRequest);
  }
}
