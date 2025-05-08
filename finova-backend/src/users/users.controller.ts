import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  Param,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SignUpUserDto } from './dto/sign-up-user.dto';
import { SignInUserDto } from './dto/sign-in-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('SignUp')
  @ApiOperation({ summary: 'Register a new user' })
  async signUp(@Body() signUpUserRequest: SignUpUserDto) {
    return this.usersService.signUpUser(signUpUserRequest);
  }

  @Post('SignIn')
  @ApiOperation({ summary: 'Sign in an existing user' })
  async signIn(@Body() signinUserRequest: SignInUserDto) {
    try {
      return await this.usersService.signIn(signinUserRequest);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Put('UpdateUserByEmail/:email')
  @ApiOperation({ summary: 'Update an existing user by email' })
  async updateUserByEmail(
    @Param('email') email: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      return await this.usersService.updateUserByEmail(email, updateUserDto);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  @UseGuards(AuthGuard('jwt')) // Use the JWT Auth Guard
  @ApiBearerAuth() // Show Bearer token field in Swagger UI
  @Get('me')
  @ApiOperation({ summary: 'Get current logged-in user' })
  async getProfile(@Req() req: any) {
    return req.user;
  }
}
