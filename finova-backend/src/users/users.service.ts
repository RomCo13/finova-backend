import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SignUpUserDto } from './dto/sign-up-user.dto';
import { User } from './schemas/user.schema';
import { SignInUserDto } from './dto/sign-in-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async signUpUser(userData: SignUpUserDto): Promise<User> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }
  async signIn(userData: SignInUserDto): Promise<User | null> {
    const { email, password } = userData;
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
  
    const isPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
  
    return existingUser;
  }
}
