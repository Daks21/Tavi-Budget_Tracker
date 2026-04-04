import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/theme';

interface BackupPromptBannerProps {
  visible: boolean;
  onBackUpNow: () => void;
  onDismiss: () => void;
}

export default function BackupPromptBanner({
  visible,
  onBackUpNow,
  onDismiss,
}: BackupPromptBannerProps) {
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  const makeStyles = (theme: any) =>
    StyleSheet.create({
      container: {
        backgroundColor: theme.colors.accentSubtle,
        borderWidth: 1,
        borderColor: theme.colors.accentSoft,
        borderRadius: theme.radius.medium,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        marginHorizontal: theme.spacing.base,
        marginVertical: theme.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
      },
      iconContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
      },
      textContainer: {
        flex: 1,
        marginHorizontal: theme.spacing.sm,
      },
      titleText: {
        fontSize: theme.typography.fontSize.bodySmall,
        lineHeight: theme.typography.lineHeight.bodySmall,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.xs,
      },
      subtitleText: {
        fontSize: theme.typography.fontSize.caption,
        lineHeight: theme.typography.lineHeight.caption,
        fontFamily: theme.typography.fontFamily.regular,
        color: theme.colors.textSecondary,
      },
      actionContainer: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: theme.spacing.sm,
      },
      backupButton: {
        paddingVertical: theme.spacing.xs,
      },
      backupButtonText: {
        fontSize: theme.typography.fontSize.caption,
        lineHeight: theme.typography.lineHeight.caption,
        fontFamily: theme.typography.fontFamily.semibold,
        color: theme.colors.accentMain,
        textDecorationLine: 'underline',
      },
      dismissButton: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
      },
      dismissIcon: {
        color: theme.colors.textSecondary,
      },
    });

  const dynamicStyles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={dynamicStyles.container}>
      {/* Left icon */}
      <View style={dynamicStyles.iconContainer}>
        <Ionicons
          name="shield"
          size={24}
          color={theme.colors.accentMain}
        />
      </View>

      {/* Text block */}
      <View style={dynamicStyles.textContainer}>
        <Text style={dynamicStyles.titleText}>
          Your data is only on this phone.
        </Text>
        <Text style={dynamicStyles.subtitleText}>
          Back it up so you never lose it.
        </Text>
      </View>

      {/* Right actions */}
      <View style={dynamicStyles.actionContainer}>
        <TouchableOpacity
          style={dynamicStyles.backupButton}
          onPress={onBackUpNow}
          activeOpacity={0.7}
        >
          <Text style={dynamicStyles.backupButtonText}>Back Up Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={dynamicStyles.dismissButton}
          onPress={onDismiss}
          activeOpacity={0.6}
        >
          <Ionicons
            name="close"
            size={18}
            style={dynamicStyles.dismissIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
