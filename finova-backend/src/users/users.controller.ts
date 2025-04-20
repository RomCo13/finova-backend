import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SignUpUserDto } from './dto/sign-up-user.dto';
import { SignInUserDto } from './dto/sign-in-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('SignUp')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignUpUserDto, description: 'The required data for registering a new user' })
  async signUp(@Body() signUpUserRequest: SignUpUserDto) {
    return this.usersService.signUpUser(signUpUserRequest);
  }

  @Post('SignIn')
  @ApiOperation({ summary: 'Sign in an existing user' })
  @ApiBody({ type: SignInUserDto, description: 'The required data for signing in an existing user' })
  async signIn(@Body() signinUserRequest: SignInUserDto) {
    try {
      return await this.usersService.signIn(signinUserRequest);
    } catch (error) {
      console.log(error)
      throw error
    }
  }
}
