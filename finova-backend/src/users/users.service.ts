import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SignUpUserDto } from './dto/sign-up-user.dto';
import { User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async signUpUser(userData: SignUpUserDto): Promise<User> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }
}
