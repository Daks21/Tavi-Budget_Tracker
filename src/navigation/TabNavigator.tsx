import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { RootTabParamList } from '../types/navigation';

import HomeScreen from '../screens/home/HomeScreen';
import WalletStack from './stacks/WalletStack';
import LogStack from './stacks/LogStack';
import PlanStack from './stacks/PlanStack';
import MoreStack from './stacks/MoreStack';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#1B2B4B',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Wallets"
        component={WalletStack}
        options={{
          tabBarLabel: 'Wallets',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Log"
        component={LogStack}
        options={{
          tabBarLabel: 'Log',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={30}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Plan"
        component={PlanStack}
        options={{
          tabBarLabel: 'Plan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'menu' : 'menu-outline'} size={20} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}